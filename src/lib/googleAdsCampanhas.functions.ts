import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createCheckoutPreference } from "@/integrations/mercadopago/client.server";
import { getValidGoogleAdsAccessToken } from "@/lib/googleAdsOAuth.functions";

// Fluxo de campanha de Google Ads gerenciada pela imoB365 (ver
// googleAdsOAuth.functions.ts pro porquê de não ser BYO por tenant):
// rascunho -> pagamento (custo + margem, via Checkout Pro da própria
// plataforma, reaproveitando o mesmo mecanismo de mercadopago.functions.ts)
// -> fila de aprovação do super_admin -> ativação manual (Fase 2a: o
// super_admin cria a campanha de verdade no painel do Google Ads e cola o
// resource_name aqui; a criação 100% automática via API — Fase 2b — só
// funciona quando a imoB365 tiver Basic Access aprovado pelo Google, que
// o Explorer Access concedido por padrão não libera pra criação de
// anúncio).
//
// IMPORTANTE, pedido explícito do usuário: orcamento_periodo e
// margem_percentual NUNCA são selecionados nas funções chamadas pelo
// tenant (listarMinhasCampanhas) — só valor_com_margem, tratado na UI
// como "investimento total". A quebra completa só aparece pras funções
// de super_admin.

async function resolveTenantId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Usuário sem imobiliária vinculada");
  return profile.tenant_id;
}

async function requireTenantAdminOrBroker(supabase: any, userId: string, tenantId: string) {
  const [{ data: isAdmin }, { data: isBroker }] = await Promise.all([
    supabase.rpc("has_role_in_tenant", { _user_id: userId, _tenant_id: tenantId, _role: "admin" }),
    supabase.rpc("has_role_in_tenant", { _user_id: userId, _tenant_id: tenantId, _role: "broker" }),
  ]);
  if (!isAdmin && !isBroker) {
    throw new Error("Sem permissão para gerenciar campanhas de Google Ads.");
  }
}

async function requireSuperAdmin(supabase: any, userId: string) {
  const { data: isSuper } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!isSuper) throw new Error("Apenas o super_admin da imoB365 pode aprovar campanhas.");
}

const MARGEM_PADRAO = 30;

const criarRascunhoSchema = z.object({
  nome: z.string().trim().min(3).max(150),
  palavrasChave: z.string().trim().min(3).max(2000),
  tipoConteudo: z.enum(["search", "display", "video", "shopping"]),
  orcamentoPeriodo: z.number().positive(),
  duracaoDias: z.number().int().min(1).max(365),
});

export const criarRascunhoCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => criarRascunhoSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; valorTotal: number }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdminOrBroker(supabase, userId, tenantId);

    const valorComMargem = Number((data.orcamentoPeriodo * (1 + MARGEM_PADRAO / 100)).toFixed(2));

    const { data: campanha, error } = await (supabaseAdmin as any)
      .from("google_ads_campanhas")
      .insert({
        tenant_id: tenantId,
        criado_por: userId,
        nome: data.nome,
        palavras_chave: data.palavrasChave,
        tipo_conteudo: data.tipoConteudo,
        orcamento_periodo: data.orcamentoPeriodo,
        duracao_dias: data.duracaoDias,
        margem_percentual: MARGEM_PADRAO,
        valor_com_margem: valorComMargem,
        status: "rascunho",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: campanha.id, valorTotal: valorComMargem };
  });

const iniciarPagamentoSchema = z.object({ campanhaId: z.string().uuid() });

export const iniciarPagamentoCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => iniciarPagamentoSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ checkoutUrl: string }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdminOrBroker(supabase, userId, tenantId);

    const { data: campanha } = await (supabaseAdmin as any)
      .from("google_ads_campanhas")
      .select("id,nome,valor_com_margem,status")
      .eq("id", data.campanhaId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!campanha) throw new Error("Campanha não encontrada.");
    if (campanha.status !== "rascunho") {
      throw new Error("Essa campanha já foi enviada pra pagamento antes.");
    }

    const { data: authUser } = await (supabaseAdmin as any).auth.admin.getUserById(userId);
    const payerEmail = authUser?.user?.email;
    if (!payerEmail) throw new Error("Não foi possível identificar seu e-mail.");

    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL não configurada.");

    const paymentReference = `google_ads_campanha:${campanha.id}`;
    const preference = await createCheckoutPreference({
      title: `imob365 - Campanha Google Ads: ${campanha.nome}`,
      price: Number(campanha.valor_com_margem),
      externalReference: paymentReference,
      payerEmail,
      backUrl: `${appUrl}/app/marketing/google-ads`,
    });

    const { error } = await (supabaseAdmin as any)
      .from("google_ads_campanhas")
      .update({ status: "aguardando_pagamento", payment_reference: paymentReference })
      .eq("id", campanha.id);
    if (error) throw new Error(error.message);

    return { checkoutUrl: preference.init_point };
  });

// Select explícito — NUNCA orcamento_periodo/margem_percentual aqui, só o
// valor final já com margem embutida (exibido como "investimento total").
export const listarMinhasCampanhas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

    const { data } = await (supabaseAdmin as any)
      .from("google_ads_campanhas")
      .select(
        "id,nome,tipo_conteudo,duracao_dias,valor_com_margem,status,motivo_rejeicao,google_campaign_resource_name,created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    return data ?? [];
  });

export const listarCampanhasParaAprovacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireSuperAdmin(supabase, userId);

    const { data } = await (supabaseAdmin as any)
      .from("google_ads_campanhas")
      .select(
        "id,tenant_id,nome,palavras_chave,tipo_conteudo,orcamento_periodo,duracao_dias,margem_percentual,valor_com_margem,status,created_at,tenants(nome)",
      )
      .in("status", ["aguardando_ativacao", "ativa", "rejeitada"])
      .order("created_at", { ascending: false })
      .limit(200);

    return data ?? [];
  });

const aprovarSchema = z.object({
  campanhaId: z.string().uuid(),
  googleCampaignResourceName: z.string().trim().min(3).max(300),
});

export const aprovarCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => aprovarSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await requireSuperAdmin(supabase, userId);

    const { data: campanha } = await (supabaseAdmin as any)
      .from("google_ads_campanhas")
      .select("id,status")
      .eq("id", data.campanhaId)
      .maybeSingle();
    if (!campanha) throw new Error("Campanha não encontrada.");
    if (campanha.status !== "aguardando_ativacao") {
      throw new Error("Só é possível ativar campanhas aguardando ativação (já pagas).");
    }

    const { error } = await (supabaseAdmin as any)
      .from("google_ads_campanhas")
      .update({
        status: "ativa",
        google_campaign_resource_name: data.googleCampaignResourceName,
        aprovado_por: userId,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", data.campanhaId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

const rejeitarSchema = z.object({
  campanhaId: z.string().uuid(),
  motivo: z.string().trim().min(3).max(500),
});

export const rejeitarCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => rejeitarSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await requireSuperAdmin(supabase, userId);

    const { error } = await (supabaseAdmin as any)
      .from("google_ads_campanhas")
      .update({
        status: "rejeitada",
        motivo_rejeicao: data.motivo,
        aprovado_por: userId,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", data.campanhaId)
      .eq("status", "aguardando_ativacao");
    if (error) throw new Error(error.message);

    return { ok: true };
  });

const performanceSchema = z.object({ campanhaId: z.string().uuid() });

export type PerformanceCampanha = {
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
};

// Leitura de performance real via GAQL — funciona com Explorer Access
// (não exige o Basic Access que só a criação/ativação de campanha
// precisa). Só retorna dado depois que a campanha tem
// google_campaign_resource_name preenchido (ativada de verdade).
export const consultarPerformanceCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => performanceSchema.parse(d))
  .handler(async ({ data, context }): Promise<PerformanceCampanha | null> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

    const { data: campanha } = await (supabaseAdmin as any)
      .from("google_ads_campanhas")
      .select("google_campaign_resource_name")
      .eq("id", data.campanhaId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!campanha?.google_campaign_resource_name) return null;

    const { accessToken, customerId } = await getValidGoogleAdsAccessToken();
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const campaignId = campanha.google_campaign_resource_name.split("/").pop();

    const query = `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE campaign.id = ${campaignId}`;
    const res = await fetch(
      `https://googleads.googleapis.com/v25/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error?.message ?? `Falha ao consultar performance (${res.status})`);
    }

    const linhas = Array.isArray(json)
      ? json.flatMap((chunk: any) => chunk.results ?? [])
      : (json?.results ?? []);
    const agregado = linhas.reduce(
      (acc: PerformanceCampanha, linha: any) => ({
        impressions: acc.impressions + Number(linha.metrics?.impressions ?? 0),
        clicks: acc.clicks + Number(linha.metrics?.clicks ?? 0),
        costMicros: acc.costMicros + Number(linha.metrics?.costMicros ?? 0),
        conversions: acc.conversions + Number(linha.metrics?.conversions ?? 0),
      }),
      { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 },
    );

    return agregado;
  });
