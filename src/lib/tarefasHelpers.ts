export type TarefaComPrazo = {
  status: string;
  prazo: string | null;
};

/**
 * Não existe status "atrasada" gravado no banco (lead_tarefas.status é só
 * pendente/concluida/cancelada) — é sempre calculado comparando `prazo` com
 * agora. Centralizado aqui porque essa mesma expressão estava duplicada em
 * app.tarefas.tsx e LeadTarefas.tsx, cada um com sua própria cópia.
 */
export function isTarefaAtrasada(tarefa: TarefaComPrazo, now: Date = new Date()): boolean {
  return tarefa.status === "pendente" && !!tarefa.prazo && new Date(tarefa.prazo) < now;
}

export function isTarefaHoje(tarefa: TarefaComPrazo, now: Date = new Date()): boolean {
  if (tarefa.status !== "pendente" || !tarefa.prazo) return false;
  const prazo = new Date(tarefa.prazo);
  return (
    prazo.getFullYear() === now.getFullYear() &&
    prazo.getMonth() === now.getMonth() &&
    prazo.getDate() === now.getDate()
  );
}
