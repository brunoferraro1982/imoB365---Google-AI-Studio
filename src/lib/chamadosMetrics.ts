// Cálculo de métricas do painel da Central de Atendimento — reaproveitado
// pelos dois desks (imoB365 em admin.atendimento.painel.tsx e tenant em
// app.atendimento.painel.tsx) pra não duplicar a mesma lógica de agregação.

export type ChamadoMetrico = {
  status: string;
  categoria: string;
  canal_origem: string;
  created_at: string;
  primeira_resposta_em: string | null;
  resolvido_em: string | null;
  csat_nota: number | null;
};

export type MetricasChamados = {
  total: number;
  abertos: number;
  resolvidos: number;
  tempoMedioRespostaMin: number | null;
  tempoMedioResolucaoHoras: number | null;
  csatMedio: number | null;
  csatRespostas: number;
  porCanal: { chave: string; total: number }[];
  porCategoria: { chave: string; total: number }[];
  porStatus: { chave: string; total: number }[];
};

const STATUS_ABERTOS = ["novo", "em_atendimento", "aguardando_cliente"];
const STATUS_RESOLVIDOS = ["resolvido", "fechado"];

function contarPor(chamados: ChamadoMetrico[], campo: "canal_origem" | "categoria" | "status") {
  const mapa = new Map<string, number>();
  for (const c of chamados) {
    const chave = c[campo];
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  }
  return Array.from(mapa.entries())
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total);
}

export function calcularMetricasChamados(chamados: ChamadoMetrico[]): MetricasChamados {
  const total = chamados.length;
  const abertos = chamados.filter((c) => STATUS_ABERTOS.includes(c.status)).length;
  const resolvidos = chamados.filter((c) => STATUS_RESOLVIDOS.includes(c.status)).length;

  const comPrimeiraResposta = chamados.filter((c) => c.primeira_resposta_em);
  const tempoMedioRespostaMin =
    comPrimeiraResposta.length > 0
      ? Math.round(
          comPrimeiraResposta.reduce((acc, c) => {
            const ms =
              new Date(c.primeira_resposta_em!).getTime() - new Date(c.created_at).getTime();
            return acc + ms / 60000;
          }, 0) / comPrimeiraResposta.length,
        )
      : null;

  const comResolucao = chamados.filter((c) => c.resolvido_em);
  const tempoMedioResolucaoHoras =
    comResolucao.length > 0
      ? Math.round(
          (comResolucao.reduce((acc, c) => {
            const ms = new Date(c.resolvido_em!).getTime() - new Date(c.created_at).getTime();
            return acc + ms / 3600000;
          }, 0) /
            comResolucao.length) *
            10,
        ) / 10
      : null;

  const comCsat = chamados.filter((c) => c.csat_nota != null);
  const csatMedio =
    comCsat.length > 0
      ? Math.round(
          (comCsat.reduce((acc, c) => acc + (c.csat_nota ?? 0), 0) / comCsat.length) * 10,
        ) / 10
      : null;

  return {
    total,
    abertos,
    resolvidos,
    tempoMedioRespostaMin,
    tempoMedioResolucaoHoras,
    csatMedio,
    csatRespostas: comCsat.length,
    porCanal: contarPor(chamados, "canal_origem"),
    porCategoria: contarPor(chamados, "categoria"),
    porStatus: contarPor(chamados, "status"),
  };
}
