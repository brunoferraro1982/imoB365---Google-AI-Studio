export type VisitaStatus = "agendada" | "confirmada" | "realizada" | "cancelada" | "nao_compareceu";

// Regex construída a partir de string ASCII literal (\\u0300-\\u036f), não de
// caracteres combinantes Unicode digitados direto — mesmo cuidado já
// documentado neste projeto (bug real antigo em captacao.ts) pra evitar erro
// de regex mal formada.
function normalizar(nome: string): string {
  return nome.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

/**
 * Reflexo Roteiro → Agenda: ao mover um card pra uma etapa cujo nome bate com
 * um padrão reconhecível, retorna o status correspondente da Agenda.
 * Best-effort — retorna null se o nome não bater com nada (cobre tenants que
 * renomearam os ETAPAS_PADRAO originais, onde não faz sentido tentar sincronizar).
 */
export function statusPelaEtapa(nomeEtapa: string | null | undefined): VisitaStatus | null {
  if (!nomeEtapa) return null;
  const n = normalizar(nomeEtapa);
  if (n.includes("realizad")) return "realizada";
  if (n.includes("cancelad")) return "cancelada";
  if (n.includes("compareceu")) return "nao_compareceu";
  return null;
}

/**
 * Reflexo Agenda → Roteiro: só pros status "terminais" (realizada/cancelada/
 * não compareceu), onde a correspondência com o nome de uma etapa é
 * inequívoca. "agendada"/"confirmada" não têm etapa padrão equivalente sem
 * ambiguidade ("A visitar" vs "Em rota"), então não tentam mover o card.
 */
export function etapaIdPeloStatus(
  status: VisitaStatus,
  etapas: { id: string; nome: string }[],
): string | null {
  const alvo =
    status === "realizada"
      ? "realizad"
      : status === "cancelada"
        ? "cancelad"
        : status === "nao_compareceu"
          ? "compareceu"
          : null;
  if (!alvo) return null;
  const match = etapas.find((e) => normalizar(e.nome).includes(alvo));
  return match?.id ?? null;
}
