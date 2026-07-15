import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminFaturamentoData = {
  kpis: {
    mrr: number;
    receita_mes: number;
    tenants_ativos_pagantes: number;
    tenants_trial: number;
    tenants_em_graca: number;
    tenants_inadimplentes: number;
    tenants_bloqueados: number;
    tenants_cancelados: number;
    tenants_free: number;
  };
  distribuicao_planos: { plano_slug: string; plano_nome: string; count: number }[];
  receita_por_mes: { mes: string; receita: number }[];
  assinaturas: {
    tenant_id: string;
    tenant_nome: string;
    plano_slug: string | null;
    plano_nome: string;
    plan_cycle: string | null;
    status: string;
    payment_status: string;
    trial_ends_at: string | null;
    trial_grace_ends_at: string | null;
    plan_expires_at: string | null;
    mercadopago_preapproval_id: string | null;
    valor_mensal_equivalente: number;
  }[];
  faturas: {
    id: string;
    tenant_id: string | null;
    tenant_nome: string;
    event_type: string;
    amount: number | null;
    currency: string | null;
    processed_at: string | null;
    created_at: string;
  }[];
};

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Severidade decrescente para ordenar a tabela de assinaturas — quem precisa
// de atenção primeiro (inadimplente/cancelado) aparece no topo.
const SEVERITY: Record<string, number> = {
  paused: 0,
  cancelled: 1,
  pending: 2,
  authorized: 3,
  none: 4,
};

export const getAdminFaturamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminFaturamentoData> => {
    const { supabase, userId } = context;

    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Acesso negado");

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [tenantsRes, plansRes, faturasRes, receitaRes] = await Promise.all([
      supabaseAdmin
        .from("tenants")
        .select(
          "id,nome,plano_slug,status,payment_status,plan_cycle,trial_ends_at,trial_grace_ends_at,plan_expires_at,mercadopago_preapproval_id,created_at",
        ),
      supabaseAdmin.from("plans").select("slug,nome,preco_mensal,preco_anual,ativo"),
      supabaseAdmin
        .from("payment_events")
        .select("id,tenant_id,event_type,amount,currency,processed_at,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("payment_events")
        .select("amount,tenant_id,created_at")
        .not("amount", "is", null)
        .gte("created_at", sixMonthsAgo.toISOString()),
    ]);

    const tenants = tenantsRes.data ?? [];
    const plans = plansRes.data ?? [];
    const faturasRaw = faturasRes.data ?? [];
    const receitaRaw = receitaRes.data ?? [];

    const planMap = new Map(plans.map((p) => [p.slug, p]));
    const tenantNomeMap = new Map(tenants.map((t) => [t.id, t.nome]));

    const isTrialEmGraca = (t: (typeof tenants)[number]) =>
      t.status === "trial" && !!t.trial_grace_ends_at && new Date(t.trial_grace_ends_at) >= now;

    const kpis = {
      mrr: 0,
      receita_mes: 0,
      tenants_ativos_pagantes: 0,
      tenants_trial: 0,
      tenants_em_graca: 0,
      tenants_inadimplentes: 0,
      tenants_bloqueados: 0,
      tenants_cancelados: 0,
      tenants_free: 0,
    };

    for (const t of tenants) {
      const plan = t.plano_slug ? planMap.get(t.plano_slug) : undefined;
      const ativoPagante = t.status === "active" && t.payment_status === "authorized";
      if (ativoPagante) {
        kpis.tenants_ativos_pagantes += 1;
        if (plan) {
          kpis.mrr +=
            t.plan_cycle === "annual"
              ? Number(plan.preco_anual ?? plan.preco_mensal * 12) / 12
              : Number(plan.preco_mensal ?? 0);
        }
      }
      if (t.status === "trial" && !isTrialEmGraca(t)) kpis.tenants_trial += 1;
      if (isTrialEmGraca(t)) kpis.tenants_em_graca += 1;
      if (t.payment_status === "paused") kpis.tenants_inadimplentes += 1;
      if (t.status === "suspended") kpis.tenants_bloqueados += 1;
      if (t.payment_status === "cancelled") kpis.tenants_cancelados += 1;
      if (t.plano_slug === "free") kpis.tenants_free += 1;
    }

    // Receita do mês: dinheiro efetivamente recebido (eventos de pagamento
    // aprovado), não estimativa de recorrência.
    const isThisMonth = (iso: string) => new Date(iso) >= firstOfMonth && new Date(iso) <= now;
    kpis.receita_mes = faturasRaw
      .filter(
        (f) =>
          (f.event_type === "payment" || f.event_type === "subscription_authorized_payment") &&
          f.amount != null &&
          isThisMonth(f.created_at),
      )
      .reduce((s, f) => s + Number(f.amount ?? 0), 0);

    // Distribuição por plano
    const distMap = new Map<string, number>();
    for (const t of tenants) {
      const slug = t.plano_slug ?? "sem-plano";
      distMap.set(slug, (distMap.get(slug) ?? 0) + 1);
    }
    const distribuicao_planos = Array.from(distMap.entries()).map(([plano_slug, count]) => ({
      plano_slug,
      plano_nome:
        planMap.get(plano_slug)?.nome ?? (plano_slug === "sem-plano" ? "Sem plano" : plano_slug),
      count,
    }));

    // Receita últimos 6 meses
    const monthMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthMap.set(ymKey(d), 0);
    }
    for (const r of receitaRaw) {
      const k = ymKey(new Date(r.created_at));
      if (monthMap.has(k)) monthMap.set(k, (monthMap.get(k) ?? 0) + Number(r.amount ?? 0));
    }
    const receita_por_mes = Array.from(monthMap.entries()).map(([mes, receita]) => ({
      mes,
      receita,
    }));

    // Assinaturas por tenant, ordenadas por severidade
    const assinaturas = tenants
      .map((t) => {
        const plan = t.plano_slug ? planMap.get(t.plano_slug) : undefined;
        const valor_mensal_equivalente = plan
          ? t.plan_cycle === "annual"
            ? Number(plan.preco_anual ?? plan.preco_mensal * 12) / 12
            : Number(plan.preco_mensal ?? 0)
          : 0;
        return {
          tenant_id: t.id,
          tenant_nome: t.nome,
          plano_slug: t.plano_slug,
          plano_nome: plan?.nome ?? t.plano_slug ?? "Sem plano",
          plan_cycle: t.plan_cycle,
          status: t.status,
          payment_status: t.payment_status,
          trial_ends_at: t.trial_ends_at,
          trial_grace_ends_at: t.trial_grace_ends_at,
          plan_expires_at: t.plan_expires_at,
          mercadopago_preapproval_id: t.mercadopago_preapproval_id,
          valor_mensal_equivalente,
        };
      })
      .sort((a, b) => (SEVERITY[a.payment_status] ?? 9) - (SEVERITY[b.payment_status] ?? 9));

    const faturas = faturasRaw.map((f) => ({
      id: f.id,
      tenant_id: f.tenant_id,
      tenant_nome: (f.tenant_id && tenantNomeMap.get(f.tenant_id)) || "—",
      event_type: f.event_type,
      amount: f.amount,
      currency: f.currency,
      processed_at: f.processed_at,
      created_at: f.created_at,
    }));

    return { kpis, distribuicao_planos, receita_por_mes, assinaturas, faturas };
  });
