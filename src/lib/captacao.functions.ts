import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
