import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processarCaptacoes } from "@/lib/captacao";

// Robô de captação automática: só tenants em planos Pro/Business têm
// acesso — feature de topo de linha. A autorização de quem-edita-o-quê
// dentro do tenant continua com a RLS (captacao_configs_admin_write); esta
// checagem aqui é o gate de plano, defesa em profundidade além do que a UI
// já esconde (ver app.leads.captacao.tsx).
// plans.slug reais (confirmado contra dev): "pro"/"business", sem prefixo
// "plan-" — o CLAUDE.md documenta uma convenção "plan-pro"/"plan-busi" que
// não bate com o schema atual (drift de documentação, não de schema).
const PLANOS_COM_ACESSO = ["pro", "business"];

async function garantirPlanoPermitido(supabase: any, tenantId: string) {
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("plano_slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant || !PLANOS_COM_ACESSO.includes(tenant.plano_slug ?? "")) {
    throw new Error("Captação automática disponível apenas nos planos Pro e Business.");
  }
}

export const listarCaptacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenant_id: string }) => z.object({ tenant_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: configs, error } = await supabase
      .from("captacao_configs")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { count: totalLeads } = await supabase
      .from("captacao_listings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", data.tenant_id)
      .not("lead_id", "is", null);

    return { configs: configs ?? [], totalLeads: totalLeads ?? 0 };
  });

const salvarCaptacaoSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  nome: z.string().min(1).max(120),
  cidade: z.string().min(1).max(120),
  uf: z.string().length(2),
  bairro: z.string().max(120).nullable().optional(),
  tipo: z.enum(["apartamento", "casa", "cobertura", "terreno", "comercial"]),
  finalidade: z.enum(["venda", "aluguel"]),
  preco_min: z.number().nonnegative().nullable().optional(),
  preco_max: z.number().nonnegative().nullable().optional(),
  intervalo_horas: z.union([z.literal(8), z.literal(12), z.literal(24), z.literal(48)]),
  ativo: z.boolean(),
});

export const salvarCaptacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => salvarCaptacaoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await garantirPlanoPermitido(supabase, data.tenant_id);

    const { id, ...payload } = data;
    if (id) {
      const { error } = await supabase.from("captacao_configs").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("captacao_configs").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removerCaptacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("captacao_configs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Botão "Sincronizar agora" (app.leads.captacao.tsx): força o processamento
// das buscas do tenant chamado ignorando o gate de intervalo_horas — usa o
// mesmo motor do cron horário (processarCaptacoes), mas com service role
// (supabaseAdmin) porque captacao_listings só tem policy de escrita pra ele
// (ver nota em create_captacao_tables.sql). Como isso contorna a RLS,
// checamos admin/broker do tenant explicitamente aqui, sem depender dela.
export const sincronizarCaptacaoAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenant_id: string }) => z.object({ tenant_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPlanoPermitido(supabase, data.tenant_id);

    const { data: isAdmin } = await supabase.rpc("has_role_in_tenant", {
      _user_id: userId,
      _tenant_id: data.tenant_id,
      _role: "admin",
    });
    const { data: isBroker } = await supabase.rpc("has_role_in_tenant", {
      _user_id: userId,
      _tenant_id: data.tenant_id,
      _role: "broker",
    });
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isAdmin && !isBroker && !isSuper) {
      throw new Error("Sem permissão para sincronizar a captação desta imobiliária.");
    }

    return processarCaptacoes(supabaseAdmin, { tenantId: data.tenant_id, forcar: true });
  });

export const toggleCaptacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; ativo: boolean }) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("captacao_configs")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Facebook Marketplace não tem API pública de leitura, a busca exige login e
// os anúncios não têm dado estruturado público (ao contrário da Chaves na
// Mão) — o robots.txt do próprio facebook.com proíbe expressamente coleta
// automatizada de dados. Por isso esta é uma importação ASSISTIDA: o
// corretor navega o Marketplace no próprio login (uso humano normal) e cola
// o link + o texto do anúncio aqui — nenhum fetch do servidor bate no
// Facebook em nenhum momento deste fluxo.
const importarMarketplaceSchema = z.object({
  tenant_id: z.string().uuid(),
  url: z.string().url().max(500),
  texto_colado: z.string().max(4000).nullable().optional(),
  titulo: z.string().min(1).max(200),
  preco: z.number().nonnegative().nullable().optional(),
  descricao: z.string().max(4000).nullable().optional(),
  nome_contato: z.string().max(120).nullable().optional(),
  telefone: z.string().max(30).nullable().optional(),
  cidade: z.string().max(120).nullable().optional(),
  bairro: z.string().max(120).nullable().optional(),
});

// Anúncios do Marketplace têm um ID numérico no próprio path da URL
// (facebook.com/marketplace/item/<id>/) — extrair isso é só string parsing
// sobre um link que o usuário já colou, não é uma requisição a lugar nenhum.
// Quando o formato não bate (usuário colou outro tipo de link), cai pra usar
// a própria URL como chave de dedupe — ainda cobre o caso mais comum de
// duplicidade acidental (colar o mesmo link duas vezes).
function extrairExternalIdMarketplace(url: string): string {
  const match = url.match(/\/item\/(\d+)/);
  return match ? match[1] : url.trim();
}

export const importarMarketplaceManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importarMarketplaceSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPlanoPermitido(supabase, data.tenant_id);

    // captacao_listings só tem policy de escrita pro service role (mesma
    // nota de sincronizarCaptacaoAgora acima) — checa admin/broker do tenant
    // aqui e segue com supabaseAdmin pros dois inserts (leads + captacao_listings).
    const { data: isAdmin } = await supabase.rpc("has_role_in_tenant", {
      _user_id: userId,
      _tenant_id: data.tenant_id,
      _role: "admin",
    });
    const { data: isBroker } = await supabase.rpc("has_role_in_tenant", {
      _user_id: userId,
      _tenant_id: data.tenant_id,
      _role: "broker",
    });
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isAdmin && !isBroker && !isSuper) {
      throw new Error("Sem permissão para importar leads nesta imobiliária.");
    }

    const externalId = extrairExternalIdMarketplace(data.url);

    const { data: existente } = await supabaseAdmin
      .from("captacao_listings")
      .select("lead_id")
      .eq("tenant_id", data.tenant_id)
      .eq("fonte", "facebook_manual")
      .eq("external_id", externalId)
      .maybeSingle();
    if (existente) {
      return { ok: true, duplicado: true, leadId: existente.lead_id as string | null };
    }

    const mensagem = [
      data.preco != null ? `Preço anunciado: R$ ${data.preco.toLocaleString("pt-BR")}` : null,
      data.descricao || null,
      `Anúncio original: ${data.url}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    // 'captacao_manual' (lead_origem) e config_id nullable (captacao_listings)
    // ainda não estão em types.ts até a migration ser aplicada e os tipos
    // regenerados (fluxo manual de sempre) — cast pontual, mesmo padrão já
    // usado em outras features novas deste projeto.
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("leads")
      .insert({
        tenant_id: data.tenant_id,
        nome: data.nome_contato || data.titulo,
        telefone: data.telefone || null,
        origem: "captacao_manual",
        mensagem,
      } as any)
      .select("id")
      .single();
    if (leadErr) throw new Error(leadErr.message);

    const { error: listingErr } = await (supabaseAdmin as any).from("captacao_listings").insert({
      tenant_id: data.tenant_id,
      config_id: null,
      fonte: "facebook_manual",
      external_id: externalId,
      url: data.url,
      dados_brutos: {
        titulo: data.titulo,
        preco: data.preco ?? null,
        descricao: data.descricao ?? null,
        texto_colado: data.texto_colado ?? null,
        cidade: data.cidade ?? null,
        bairro: data.bairro ?? null,
      },
      lead_id: (lead as any)!.id,
    });
    if (listingErr) throw new Error(listingErr.message);

    return { ok: true, duplicado: false, leadId: lead!.id as string };
  });
