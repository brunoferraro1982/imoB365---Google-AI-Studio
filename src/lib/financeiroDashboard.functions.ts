import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FinanceiroDashboardData = {
  inadimplencia: { total_atrasado: number; count_atrasado: number; total_pendente: number };
  comissoes: { total_paga: number; total_a_pagar: number; count_a_pagar: number };
  receita_por_corretor: { corretor: string; total: number }[];
  rentabilidade_por_imovel: {
    imovel: string;
    aluguel: number;
    despesas: number;
    liquido: number;
  }[];
  fluxo_caixa_projetado: { mes: string; entradas: number; saidas: number }[];
  // Fase 5: projeção estatística simples (média dos últimos meses com
  // lançamento realizado) — null quando não há histórico suficiente.
  // Deliberadamente NÃO é IA/ML: a base ainda não tem 6-12 meses de
  // histórico real pra sustentar previsão de verdade.
  media_historica_entradas: number | null;
  media_historica_saidas: number | null;
};

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Dashboards executivos do Financeiro (Fase 1 item 5 do incremento do
// módulo): inadimplência, comissões, receita por corretor (em R$, não em
// contagem de leads como o ranking já existente em relatorios.functions.ts),
// rentabilidade por carteira de imóveis e fluxo de caixa projetado — os 5
// indicadores realistas de calcular com dado que já existe hoje, sem IA.
export const getFinanceiroDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FinanceiroDashboardData> => {
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
    const inicioMesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const fimJanela = new Date(now.getFullYear(), now.getMonth() + 6, 0).toISOString().slice(0, 10);

    const inicioHistorico = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      .toISOString()
      .slice(0, 10);

    const [lancRes, comissoesRes, corretoresRes, contratosRes, historicoRes] = await Promise.all([
      supabase
        .from("lancamentos_financeiros")
        .select("tipo,valor,status,data_vencimento,imovel_id")
        .eq("tenant_id", tenantId)
        .lte("data_vencimento", fimJanela),
      supabase.from("comissoes").select("valor,status,corretor_id").eq("tenant_id", tenantId),
      supabase.from("corretores").select("id,nome").eq("tenant_id", tenantId),
      supabase
        .from("contratos")
        .select("id,imovel:imoveis(id,titulo)")
        .eq("tenant_id", tenantId)
        .eq("tipo", "locacao")
        .eq("status", "ativo")
        .not("imovel_id", "is", null),
      supabase
        .from("lancamentos_financeiros")
        .select("tipo,valor,data_pagamento")
        .eq("tenant_id", tenantId)
        .eq("status", "pago")
        .gte("data_pagamento", inicioHistorico),
    ]);

    const lanc = lancRes.data ?? [];
    const comissoes = comissoesRes.data ?? [];
    const corretores = corretoresRes.data ?? [];
    const contratos = contratosRes.data ?? [];
    const historico = historicoRes.data ?? [];

    // Inadimplência
    const atrasados = lanc.filter((l) => l.status === "atrasado");
    const inadimplencia = {
      total_atrasado: atrasados.reduce((s, l) => s + Number(l.valor ?? 0), 0),
      count_atrasado: atrasados.length,
      total_pendente: lanc
        .filter((l) => l.status === "pendente")
        .reduce((s, l) => s + Number(l.valor ?? 0), 0),
    };

    // Comissões
    const comissoesPagas = comissoes.filter((c) => c.status === "paga");
    const comissoesAPagar = comissoes.filter((c) => c.status === "a_pagar");
    const comissoesData = {
      total_paga: comissoesPagas.reduce((s, c) => s + Number(c.valor ?? 0), 0),
      total_a_pagar: comissoesAPagar.reduce((s, c) => s + Number(c.valor ?? 0), 0),
      count_a_pagar: comissoesAPagar.length,
    };

    // Receita por corretor (soma de comissoes.valor, não contagem de leads)
    const corretorNome = new Map(corretores.map((c) => [c.id, c.nome]));
    const porCorretor = new Map<string, number>();
    for (const c of comissoes) {
      if (c.status === "cancelada") continue;
      const nome = corretorNome.get(c.corretor_id) ?? "—";
      porCorretor.set(nome, (porCorretor.get(nome) ?? 0) + Number(c.valor ?? 0));
    }
    const receita_por_corretor = Array.from(porCorretor.entries())
      .map(([corretor, total]) => ({ corretor, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Rentabilidade por carteira de imóveis (mês corrente): aluguel repassado
    // (locacao_repasses) menos despesas do próprio imóvel no mesmo período.
    const contratoIds = contratos.map((c) => c.id);
    const { data: repassesMes } =
      contratoIds.length > 0
        ? await supabase
            .from("locacao_repasses")
            .select("contrato_id,valor_repasse")
            .in("contrato_id", contratoIds)
            .eq("mes_referencia", inicioMesAtual)
        : { data: [] as { contrato_id: string; valor_repasse: number }[] };

    const repassePorContrato = new Map(
      (repassesMes ?? []).map((r) => [r.contrato_id, Number(r.valor_repasse ?? 0)]),
    );

    const despesasPorImovel = new Map<string, number>();
    for (const l of lanc) {
      if (l.tipo !== "despesa" || !l.imovel_id) continue;
      if (l.data_vencimento < inicioMesAtual) continue;
      despesasPorImovel.set(
        l.imovel_id,
        (despesasPorImovel.get(l.imovel_id) ?? 0) + Number(l.valor ?? 0),
      );
    }

    const rentabilidade_por_imovel = contratos
      .map((c) => {
        const im = (c as any).imovel;
        if (!im) return null;
        const aluguel = repassePorContrato.get(c.id) ?? 0;
        const despesas = despesasPorImovel.get(im.id) ?? 0;
        return {
          imovel: im.titulo ?? "Sem título",
          aluguel,
          despesas,
          liquido: aluguel - despesas,
        };
      })
      .filter(
        (x): x is { imovel: string; aluguel: number; despesas: number; liquido: number } => !!x,
      )
      .sort((a, b) => b.liquido - a.liquido);

    // Fluxo de caixa projetado: lançamentos ainda não realizados (pendente/
    // atrasado), próximos 6 meses a partir do mês corrente — sem IA/previsão,
    // é o que já está lançado e ainda vai vencer.
    const monthMap = new Map<string, { entradas: number; saidas: number }>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      monthMap.set(ymKey(d), { entradas: 0, saidas: 0 });
    }
    for (const l of lanc) {
      if (l.status !== "pendente" && l.status !== "atrasado") continue;
      const k = ymKey(new Date(`${l.data_vencimento}T12:00:00`));
      const bucket = monthMap.get(k);
      if (!bucket) continue;
      if (l.tipo === "receita") bucket.entradas += Number(l.valor ?? 0);
      else if (l.tipo === "despesa") bucket.saidas += Number(l.valor ?? 0);
    }
    const fluxo_caixa_projetado = Array.from(monthMap.entries()).map(([mes, v]) => ({
      mes,
      entradas: v.entradas,
      saidas: v.saidas,
    }));

    // Fase 5: média histórica simples (últimos meses com lançamento
    // realizado) — divide pelo número de meses que de fato têm dado, não
    // por 6 fixo, pra não diluir a média num tenant novo com pouco
    // histórico. Sem dado nenhum, devolve null (UI omite a referência).
    const mesesComHistorico = new Set<string>();
    let totalEntradasHistorico = 0;
    let totalSaidasHistorico = 0;
    for (const l of historico) {
      if (!l.data_pagamento) continue;
      mesesComHistorico.add(ymKey(new Date(`${l.data_pagamento}T12:00:00`)));
      if (l.tipo === "receita") totalEntradasHistorico += Number(l.valor ?? 0);
      else if (l.tipo === "despesa") totalSaidasHistorico += Number(l.valor ?? 0);
    }
    const numMesesHistorico = mesesComHistorico.size;
    const media_historica_entradas =
      numMesesHistorico > 0 ? totalEntradasHistorico / numMesesHistorico : null;
    const media_historica_saidas =
      numMesesHistorico > 0 ? totalSaidasHistorico / numMesesHistorico : null;

    return {
      inadimplencia,
      comissoes: comissoesData,
      receita_por_corretor,
      rentabilidade_por_imovel,
      fluxo_caixa_projetado,
      media_historica_entradas,
      media_historica_saidas,
    };
  });
