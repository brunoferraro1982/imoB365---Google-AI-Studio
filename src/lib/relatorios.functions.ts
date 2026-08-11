import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  periodoDias: z.number().int().min(7).max(365).default(30),
});

export type RelatoriosData = {
  kpis: {
    imoveis_ativos: number;
    imoveis_publicados: number;
    valor_estoque: number;
    leads_total: number;
    leads_novos: number;
    leads_ganhos: number;
    leads_perdidos: number;
    contratos_abertos: number;
    receita_mes: number;
    despesa_mes: number;
    pendente_total: number;
  };
  funil: { status: string; count: number }[];
  leads_por_dia: { data: string; novos: number }[];
  financeiro_por_mes: { mes: string; entradas: number; saidas: number }[];
  financeiro_por_centro_custo: { centro_custo: string; entradas: number; saidas: number }[];
  financeiro_por_plano_conta: { plano_conta: string; tipo: string; total: number }[];
  ranking_corretores: { corretor: string; leads: number; ganhos: number }[];
  ranking_imoveis: {
    id: string;
    titulo: string;
    bairro: string;
    tipo: string;
    preco: number;
    pageviews: number;
    whatsapp_clicks: number;
    favorited: number;
    conversion_rate: number;
  }[];
  imoveis_por_tipo: { tipo: string; count: number }[];
  funil_conversao: {
    etapa: string;
    label: string;
    count: number;
    pct_acumulado: number;
    conversao_proxima: number | null;
  }[];
  tempo_medio_dias: {
    ate_contato: number | null;
    ate_visita: number | null;
    ate_ganho: number | null;
  };
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const getRelatorios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<RelatoriosData> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      throw new Error("Usuário sem imobiliária vinculada");
    }

    const now = new Date();
    const since = startOfDay(new Date(now.getTime() - data.periodoDias * 24 * 3600 * 1000));
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      imoveisRes,
      leadsRes,
      contratosRes,
      lancRes,
      corretoresRes,
      planoContasRes,
      centrosCustoRes,
    ] = await Promise.all([
      supabase
        .from("imoveis")
        .select("id,titulo,endereco_bairro,status,publicado,preco,tipo,created_at")
        .eq("tenant_id", tenantId),
      supabase
        .from("leads")
        .select("id,status,corretor_id,created_at,ganho_em,last_contact_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", since.toISOString()),
      supabase
        .from("contratos")
        .select("id,status,valor,tipo,created_at")
        .eq("tenant_id", tenantId),
      supabase
        .from("lancamentos_financeiros")
        .select(
          "id,tipo,valor,status,data_vencimento,data_pagamento,plano_conta_id,centro_custo_id",
        )
        .eq("tenant_id", tenantId)
        .gte("data_vencimento", isoDay(sixMonthsAgo)),
      supabase.from("corretores").select("id,nome,ativo").eq("tenant_id", tenantId),
      supabase.from("plano_contas").select("id,codigo,nome,tipo").eq("tenant_id", tenantId),
      supabase.from("centros_custo").select("id,codigo,nome").eq("tenant_id", tenantId),
    ]);

    const imoveis = imoveisRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const contratos = contratosRes.data ?? [];
    const lanc = lancRes.data ?? [];
    const corretores = corretoresRes.data ?? [];
    const planoContas = planoContasRes.data ?? [];
    const centrosCusto = centrosCustoRes.data ?? [];

    // KPIs imóveis
    const imoveis_ativos = imoveis.filter((i) => i.status === "ativo").length;
    const imoveis_publicados = imoveis.filter((i) => i.publicado && i.status === "ativo").length;
    const valor_estoque = imoveis
      .filter((i) => i.status === "ativo")
      .reduce((s, i) => s + Number(i.preco ?? 0), 0);

    // Leads
    const leads_total = leads.length;
    const leads_novos = leads.filter((l) => l.status === "novo").length;
    const leads_ganhos = leads.filter((l) => l.status === "ganho").length;
    const leads_perdidos = leads.filter((l) => l.status === "perdido").length;

    // Contratos
    const contratos_abertos = contratos.filter((c) =>
      ["rascunho", "ativo"].includes(c.status as string),
    ).length;

    // Financeiro mês atual
    const isThisMonth = (iso: string | null) =>
      iso ? new Date(iso) >= firstOfMonth && new Date(iso) <= now : false;
    const receita_mes = lanc
      .filter((l) => l.tipo === "receita" && l.status === "pago" && isThisMonth(l.data_pagamento))
      .reduce((s, l) => s + Number(l.valor ?? 0), 0);
    const despesa_mes = lanc
      .filter((l) => l.tipo === "despesa" && l.status === "pago" && isThisMonth(l.data_pagamento))
      .reduce((s, l) => s + Number(l.valor ?? 0), 0);
    const pendente_total = lanc
      .filter((l) => l.status === "pendente")
      .reduce((s, l) => s + Number(l.valor ?? 0), 0);

    // Funil
    const funilMap = new Map<string, number>();
    for (const l of leads)
      funilMap.set(l.status as string, (funilMap.get(l.status as string) ?? 0) + 1);
    const funil = Array.from(funilMap.entries()).map(([status, count]) => ({ status, count }));

    // Funil de conversão acumulado (lead que chegou em uma etapa = passou por todas anteriores)
    const ORDEM = ["novo", "contato", "visita", "proposta", "ganho"] as const;
    const LABEL: Record<string, string> = {
      novo: "Novo",
      contato: "Em contato",
      visita: "Visita",
      proposta: "Proposta",
      ganho: "Ganho",
    };
    // ranking de status (perdido fica fora do funil)
    const rank = (s: string) => ORDEM.indexOf(s as any);
    const counts = ORDEM.map(
      (etapa) =>
        leads.filter((l) => l.status !== "perdido" && rank(l.status as string) >= rank(etapa))
          .length,
    );
    const topo = counts[0] || 0;
    const funil_conversao = ORDEM.map((etapa, i) => ({
      etapa,
      label: LABEL[etapa],
      count: counts[i],
      pct_acumulado: topo > 0 ? Math.round((counts[i] / topo) * 100) : 0,
      conversao_proxima:
        i < ORDEM.length - 1 && counts[i] > 0
          ? Math.round((counts[i + 1] / counts[i]) * 100)
          : null,
    }));

    // Tempo médio (dias) — usa ganho_em quando disponível
    const diffDays = (a: string, b: string) =>
      (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
    const ganhos = leads.filter((l) => l.status === "ganho" && (l as any).ganho_em);
    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 : null;
    const tempo_medio_dias = {
      ate_contato: avg(
        leads
          .filter((l) => rank(l.status as string) >= 1 && (l as any).last_contact_at)
          .map((l) => diffDays(l.created_at as string, (l as any).last_contact_at)),
      ),
      ate_visita: null, // sem timestamp dedicado
      ate_ganho: avg(ganhos.map((l) => diffDays(l.created_at as string, (l as any).ganho_em))),
    };

    // Leads por dia (últimos N dias)
    const dayMap = new Map<string, number>();
    for (let i = data.periodoDias - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      dayMap.set(isoDay(d), 0);
    }
    for (const l of leads) {
      const k = isoDay(new Date(l.created_at as string));
      if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
    }
    const leads_por_dia = Array.from(dayMap.entries()).map(([data, novos]) => ({ data, novos }));

    // Financeiro últimos 6 meses
    const monthMap = new Map<string, { entradas: number; saidas: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthMap.set(ymKey(d), { entradas: 0, saidas: 0 });
    }
    for (const l of lanc) {
      const ref = l.data_pagamento ?? l.data_vencimento;
      if (!ref) continue;
      const k = ymKey(new Date(ref as string));
      const bucket = monthMap.get(k);
      if (!bucket) continue;
      if (l.tipo === "receita") bucket.entradas += Number(l.valor ?? 0);
      else if (l.tipo === "despesa") bucket.saidas += Number(l.valor ?? 0);
    }
    const financeiro_por_mes = Array.from(monthMap.entries()).map(([mes, v]) => ({
      mes,
      entradas: v.entradas,
      saidas: v.saidas,
    }));

    // Financeiro por centro de custo (mesmo período de 6 meses de financeiro_por_mes)
    const NAO_CLASSIFICADO = "Não classificado";
    const centroCustoNome = new Map(centrosCusto.map((c) => [c.id, `${c.codigo} — ${c.nome}`]));
    const centroCustoMap = new Map<string, { entradas: number; saidas: number }>();
    for (const l of lanc) {
      const key = l.centro_custo_id
        ? (centroCustoNome.get(l.centro_custo_id) ?? "—")
        : NAO_CLASSIFICADO;
      const b = centroCustoMap.get(key) ?? { entradas: 0, saidas: 0 };
      if (l.tipo === "receita") b.entradas += Number(l.valor ?? 0);
      else if (l.tipo === "despesa") b.saidas += Number(l.valor ?? 0);
      centroCustoMap.set(key, b);
    }
    const financeiro_por_centro_custo = Array.from(centroCustoMap.entries())
      .map(([centro_custo, v]) => ({ centro_custo, entradas: v.entradas, saidas: v.saidas }))
      .sort((a, b) => b.entradas + b.saidas - (a.entradas + a.saidas))
      .slice(0, 8);

    // Financeiro por plano de contas — cada plano de conta já tem um tipo
    // fixo (receita/despesa), então o total nunca mistura os dois; o que não
    // tem plano_conta_id vinculado vira um bucket "Não classificado" por tipo.
    const planoContaInfo = new Map(
      planoContas.map((p) => [p.id, { label: `${p.codigo} — ${p.nome}`, tipo: p.tipo as string }]),
    );
    const planoContaMap = new Map<string, { tipo: string; total: number }>();
    for (const l of lanc) {
      const pc = l.plano_conta_id ? planoContaInfo.get(l.plano_conta_id) : undefined;
      const tipo = pc?.tipo ?? (l.tipo as string);
      const key = pc ? pc.label : `${NAO_CLASSIFICADO} (${tipo})`;
      const b = planoContaMap.get(key) ?? { tipo, total: 0 };
      b.total += Number(l.valor ?? 0);
      planoContaMap.set(key, b);
    }
    const financeiro_por_plano_conta = Array.from(planoContaMap.entries())
      .map(([plano_conta, v]) => ({ plano_conta, tipo: v.tipo, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Ranking corretores
    const corretorNome = new Map(corretores.map((c) => [c.id, c.nome]));
    const corretorLeads = new Map<string, { leads: number; ganhos: number }>();
    for (const l of leads) {
      if (!l.corretor_id) continue;
      const b = corretorLeads.get(l.corretor_id) ?? { leads: 0, ganhos: 0 };
      b.leads += 1;
      if (l.status === "ganho") b.ganhos += 1;
      corretorLeads.set(l.corretor_id, b);
    }
    const ranking_corretores = Array.from(corretorLeads.entries())
      .map(([id, v]) => ({
        corretor: corretorNome.get(id) ?? "—",
        leads: v.leads,
        ganhos: v.ganhos,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 5);

    // Imóveis por tipo (ativos)
    const tipoMap = new Map<string, number>();
    for (const i of imoveis.filter((x) => x.status === "ativo")) {
      tipoMap.set(i.tipo as string, (tipoMap.get(i.tipo as string) ?? 0) + 1);
    }
    const imoveis_por_tipo = Array.from(tipoMap.entries())
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Desempenho e Performance de Imóveis — métricas REAIS: views e cliques de
    // WhatsApp vêm da tabela imovel_eventos (tracking first-party na página
    // pública); favoritos da tabela favoritos. Tudo agregado pela RPC
    // relatorio_metricas_imoveis (tenant resolvido do próprio auth.uid()).
    const activeListings = imoveis.filter((x) => x.status === "ativo" && x.publicado);
    const { data: metricasRows } = await (supabase as any).rpc("relatorio_metricas_imoveis");
    const metricasMap = new Map<
      string,
      { views: number; whatsapp_clicks: number; favoritos: number }
    >(
      ((metricasRows ?? []) as any[]).map((m) => [
        m.imovel_id,
        {
          views: Number(m.views) || 0,
          whatsapp_clicks: Number(m.whatsapp_clicks) || 0,
          favoritos: Number(m.favoritos) || 0,
        },
      ]),
    );
    const ranking_imoveis = activeListings
      .map((im) => {
        const met = metricasMap.get(im.id) ?? { views: 0, whatsapp_clicks: 0, favoritos: 0 };
        const conversion_rate =
          met.views > 0 ? Math.round((met.whatsapp_clicks / met.views) * 100) : 0;
        return {
          id: im.id,
          titulo: im.titulo || "Sem título",
          bairro: im.endereco_bairro || "Centro",
          tipo: im.tipo,
          preco: Number(im.preco || 0),
          pageviews: met.views,
          whatsapp_clicks: met.whatsapp_clicks,
          favorited: met.favoritos,
          conversion_rate,
        };
      })
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 8);

    return {
      kpis: {
        imoveis_ativos,
        imoveis_publicados,
        valor_estoque,
        leads_total,
        leads_novos,
        leads_ganhos,
        leads_perdidos,
        contratos_abertos,
        receita_mes,
        despesa_mes,
        pendente_total,
      },
      funil,
      leads_por_dia,
      financeiro_por_mes,
      financeiro_por_centro_custo,
      financeiro_por_plano_conta,
      ranking_corretores,
      ranking_imoveis,
      imoveis_por_tipo,
      funil_conversao,
      tempo_medio_dias,
    };
  });
