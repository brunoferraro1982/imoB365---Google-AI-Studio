// Núcleo da verificação de SLA de Jurídico: cartórios parados e contratos a
// vencer. Usado tanto pelo botão "Verificar agora" (server function
// autenticada, respeitando RLS) quanto pelo endpoint /api/public/cron
// (service role, todos os tenants) — ver src/lib/slaAlertas.functions.ts e
// src/routes/api.public.cron.contratos-sla.ts.

export const SLA_CARTORIO_DIAS = 15;
export const CONTRATO_VENCIMENTO_DIAS = 90;

const CARTORIO_TIPO_LABEL: Record<string, string> = {
  escritura: "Escritura",
  registro: "Registro",
  averbacao: "Averbação",
  procuracao: "Procuração",
  outro: "Documento",
};

// Subconjunto mínimo do client do supabase-js usado aqui, para aceitar tanto
// o client autenticado (RLS) quanto o supabaseAdmin (service role) sem
// acoplar a um tipo de Database específico.
export interface SlaSupabaseClient {
  from: (table: string) => any;
}

export type SlaCheckResult = {
  cartoriosAlertados: number;
  contratosAlertados: number;
};

async function resolverResponsavel(
  client: SlaSupabaseClient,
  corretorId: string | null,
): Promise<string | null> {
  if (!corretorId) return null;
  const { data } = await client
    .from("corretores")
    .select("user_id")
    .eq("id", corretorId)
    .maybeSingle();
  return (data as { user_id: string | null } | null)?.user_id ?? null;
}

async function verificarCartoriosParados(
  client: SlaSupabaseClient,
  tenantId?: string,
): Promise<number> {
  const limite = new Date(Date.now() - SLA_CARTORIO_DIAS * 24 * 60 * 60 * 1000).toISOString();

  let query = client
    .from("cartorio_registros")
    .select(
      "id,tenant_id,tipo,cartorio_nome,updated_at,contrato_id,contrato:contratos(corretor_id,numero)",
    )
    .in("status", ["pendente", "protocolado", "em_exigencia"])
    .lt("updated_at", limite)
    .limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: registros } = await query;

  let alertados = 0;
  for (const r of registros ?? []) {
    const { data: existente } = await client
      .from("lead_tarefas")
      .select("id")
      .eq("cartorio_registro_id", r.id)
      .eq("tipo", "sla_cartorio")
      .eq("status", "pendente")
      .limit(1);
    if (existente && existente.length > 0) continue;

    const corretorId = (r as any).contrato?.corretor_id ?? null;
    const responsavelUserId = await resolverResponsavel(client, corretorId);
    const numeroContrato = (r as any).contrato?.numero;

    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: r.tenant_id,
      cartorio_registro_id: r.id,
      contrato_id: r.contrato_id,
      responsavel_user_id: responsavelUserId,
      titulo: `SLA: ${CARTORIO_TIPO_LABEL[r.tipo] ?? r.tipo} parado(a) em cartório há mais de ${SLA_CARTORIO_DIAS} dias`,
      descricao: [r.cartorio_nome, numeroContrato ? `Contrato #${numeroContrato}` : null]
        .filter(Boolean)
        .join(" · "),
      tipo: "sla_cartorio",
      prioridade: "alta",
      status: "pendente",
      prazo: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (!error) alertados++;
  }
  return alertados;
}

async function verificarContratosAVencer(
  client: SlaSupabaseClient,
  tenantId?: string,
): Promise<number> {
  const limite = new Date();
  limite.setDate(limite.getDate() + CONTRATO_VENCIMENTO_DIAS);

  let query = client
    .from("contratos")
    .select("id,tenant_id,numero,corretor_id,data_fim")
    .eq("status", "ativo")
    .not("data_fim", "is", null)
    .lte("data_fim", limite.toISOString().slice(0, 10))
    .limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: contratos } = await query;

  let alertados = 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  for (const c of contratos ?? []) {
    const { data: existente } = await client
      .from("lead_tarefas")
      .select("id")
      .eq("contrato_id", c.id)
      .eq("tipo", "contrato_vencimento")
      .eq("status", "pendente")
      .limit(1);
    if (existente && existente.length > 0) continue;

    const dataFim = new Date(`${c.data_fim}T00:00:00`);
    const diasRestantes = Math.round((dataFim.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));
    const numero = c.numero ? `#${c.numero}` : "";
    const vencido = diasRestantes < 0;

    const responsavelUserId = await resolverResponsavel(client, c.corretor_id);

    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: c.tenant_id,
      contrato_id: c.id,
      responsavel_user_id: responsavelUserId,
      titulo: vencido
        ? `Contrato ${numero} venceu há ${Math.abs(diasRestantes)} dia(s) — verificar renovação/encerramento`
        : `Contrato ${numero} vence em ${diasRestantes} dia(s)`,
      tipo: "contrato_vencimento",
      prioridade: vencido || diasRestantes <= 30 ? "alta" : diasRestantes <= 60 ? "media" : "baixa",
      status: "pendente",
      prazo: dataFim.toISOString(),
    });
    if (!error) alertados++;
  }
  return alertados;
}

export async function runSlaCheck(
  client: SlaSupabaseClient,
  opts?: { tenantId?: string },
): Promise<SlaCheckResult> {
  const [cartoriosAlertados, contratosAlertados] = await Promise.all([
    verificarCartoriosParados(client, opts?.tenantId),
    verificarContratosAVencer(client, opts?.tenantId),
  ]);
  return { cartoriosAlertados, contratosAlertados };
}
