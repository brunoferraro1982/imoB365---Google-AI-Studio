import type { SupabaseClient } from "@supabase/supabase-js";

// Detecção de estouro de SLA da Central de Atendimento — mesmo padrão de
// slaAlertas.ts (CLM): dedupe checando se já existe uma lead_tarefas
// pendente do mesmo tipo pro chamado antes de criar outra, cria uma
// tarefa endereçada ao atendente responsável (ou não-endereçada, se o
// chamado ainda não foi atribuído a ninguém).
//
// Achado real testando: lead_tarefas.tenant_id é NOT NULL, mas um chamado
// sem contexto (responsavel_tipo='imob365', aguardando triagem manual)
// tem chamados.tenant_id null por design — o INSERT falhava
// silenciosamente (erro não checado no destructuring, mesma classe de bug
// já documentada várias vezes neste projeto). Corrigido resolvendo pro
// tenant corporativo da imoB365 nesse caso, já que quem vai tratar essa
// tarefa é a própria equipe interna (membro do tenant "imob365").

async function jaTemTarefaPendente(
  client: SupabaseClient,
  chamadoId: string,
  tipo: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("lead_tarefas")
    .select("id")
    .eq("chamado_id", chamadoId)
    .eq("tipo", tipo)
    .eq("status", "pendente")
    .limit(1);
  if (error) {
    console.error("[atendimentoSla] erro ao checar tarefa existente", error);
  }
  return !!data && data.length > 0;
}

async function resolverTenantIdCorporativo(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.from("tenants").select("id").eq("slug", "imob365").maybeSingle();
  return data?.id ?? null;
}

export async function verificarChamadosSLA(
  client: SupabaseClient,
): Promise<{ primeiraRespostaEstourada: number; resolucaoEstourada: number }> {
  const agora = new Date().toISOString();
  let primeiraRespostaEstourada = 0;
  let resolucaoEstourada = 0;
  const tenantCorporativoId = await resolverTenantIdCorporativo(client);

  const { data: semResposta, error: erroSemResposta } = await client
    .from("chamados")
    .select("id,tenant_id,numero,assunto,atribuido_user_id,sla_prazo_primeira_resposta")
    .not("status", "in", "(resolvido,fechado)")
    .is("primeira_resposta_em", null)
    .lt("sla_prazo_primeira_resposta", agora)
    .limit(200);
  if (erroSemResposta) {
    console.error(
      "[atendimentoSla] erro ao buscar chamados sem primeira resposta",
      erroSemResposta,
    );
  }

  for (const c of semResposta ?? []) {
    if (await jaTemTarefaPendente(client, c.id, "chamado_sla_primeira_resposta")) continue;
    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: c.tenant_id ?? tenantCorporativoId,
      chamado_id: c.id,
      responsavel_user_id: c.atribuido_user_id,
      titulo: `SLA estourado: primeira resposta do chamado ${c.numero}`,
      descricao: c.assunto,
      tipo: "chamado_sla_primeira_resposta",
      prioridade: "alta",
      status: "pendente",
      prazo: agora,
    } as never);
    if (error) {
      console.error("[atendimentoSla] erro ao criar tarefa de primeira resposta", error);
      continue;
    }
    primeiraRespostaEstourada++;
  }

  const { data: semResolucao, error: erroSemResolucao } = await client
    .from("chamados")
    .select("id,tenant_id,numero,assunto,atribuido_user_id,sla_prazo_resolucao")
    .not("status", "in", "(resolvido,fechado)")
    .lt("sla_prazo_resolucao", agora)
    .limit(200);
  if (erroSemResolucao) {
    console.error("[atendimentoSla] erro ao buscar chamados sem resolução", erroSemResolucao);
  }

  for (const c of semResolucao ?? []) {
    if (await jaTemTarefaPendente(client, c.id, "chamado_sla_resolucao")) continue;
    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: c.tenant_id ?? tenantCorporativoId,
      chamado_id: c.id,
      responsavel_user_id: c.atribuido_user_id,
      titulo: `SLA estourado: resolução do chamado ${c.numero}`,
      descricao: c.assunto,
      tipo: "chamado_sla_resolucao",
      prioridade: "alta",
      status: "pendente",
      prazo: agora,
    } as never);
    if (error) {
      console.error("[atendimentoSla] erro ao criar tarefa de resolução", error);
      continue;
    }
    resolucaoEstourada++;
  }

  return { primeiraRespostaEstourada, resolucaoEstourada };
}
