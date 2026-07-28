// Núcleo da verificação de SLA de Jurídico: cartórios parados e contratos a
// vencer. Usado tanto pelo botão "Verificar agora" (server function
// autenticada, respeitando RLS) quanto pelo endpoint /api/public/cron
// (service role, todos os tenants) — ver src/lib/slaAlertas.functions.ts e
// src/routes/api.public.cron.contratos-sla.ts.

export const SLA_CARTORIO_DIAS = 15;
export const CONTRATO_VENCIMENTO_DIAS = 90;
// CLM Sprint 11 — janela de antecedência dos novos alertas (garantia,
// reajuste, vistoria, documento, renovação automática) e limite de "aberta
// há muito tempo" pra ordem de serviço.
export const ALERTA_ANTECEDENCIA_DIAS = 30;
export const ORDEM_SERVICO_ATRASO_DIAS = 30;

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
  garantiasAlertadas: number;
  reajustesAlertados: number;
  vistoriasAlertadas: number;
  ordensServicoAlertadas: number;
  documentosAlertados: number;
  renovacoesAlertadas: number;
};

// Alertas de maior severidade (documento expirado — RG/CNH vencido pode
// travar assinatura/jurídico) também disparam e-mail, não só task — mas
// buscar o e-mail do responsável exige a admin API (auth.admin.getUserById),
// que só o supabaseAdmin tem. O client RLS do botão "Verificar agora" não
// consegue enviar e-mail — por isso este parâmetro é opcional, fornecido
// só pelo caminho de cron (ver api.public.cron.contratos-sla.ts).
export type EnviarEmailAlerta = (opts: {
  tenantId: string;
  userId: string | null;
  subject: string;
  html: string;
  label: string;
}) => Promise<void>;

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

// CLM Sprint 11 — as 4 tabelas locacao_* (garantias, reajustes, vistorias,
// ordens de serviço) existem desde 2026-05-21 com schema/RLS prontos, mas
// nenhuma automação as consumia até este sprint (mesmo achado real já
// documentado várias vezes no changelog do projeto).

async function verificarGarantiasVencendo(
  client: SlaSupabaseClient,
  tenantId?: string,
): Promise<number> {
  const limite = new Date(Date.now() + ALERTA_ANTECEDENCIA_DIAS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let query = client
    .from("locacao_garantias")
    .select("id,tenant_id,contrato_id,tipo,vencimento,contrato:contratos(corretor_id,numero)")
    .eq("ativo", true)
    .not("vencimento", "is", null)
    .lte("vencimento", limite)
    .limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: garantias } = await query;

  let alertados = 0;
  for (const g of garantias ?? []) {
    const { data: existente } = await client
      .from("lead_tarefas")
      .select("id")
      .eq("contrato_id", g.contrato_id)
      .eq("tipo", "garantia_vencimento")
      .eq("status", "pendente")
      .limit(1);
    if (existente && existente.length > 0) continue;

    const corretorId = (g as any).contrato?.corretor_id ?? null;
    const numero = (g as any).contrato?.numero;
    const responsavelUserId = await resolverResponsavel(client, corretorId);
    const vencida = g.vencimento < new Date().toISOString().slice(0, 10);

    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: g.tenant_id,
      contrato_id: g.contrato_id,
      responsavel_user_id: responsavelUserId,
      titulo: `Garantia (${g.tipo}) ${vencida ? "venceu" : "vence em breve"} — contrato ${numero ? `#${numero}` : ""}`,
      tipo: "garantia_vencimento",
      prioridade: vencida ? "alta" : "media",
      status: "pendente",
      prazo: `${g.vencimento}T00:00:00`,
    });
    if (!error) alertados++;
  }
  return alertados;
}

async function verificarReajustesPendentes(
  client: SlaSupabaseClient,
  tenantId?: string,
): Promise<number> {
  const limite = new Date(Date.now() + ALERTA_ANTECEDENCIA_DIAS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let query = client
    .from("locacao_reajustes")
    .select(
      "id,tenant_id,contrato_id,indice,proximo_reajuste,contrato:contratos(corretor_id,numero)",
    )
    .not("proximo_reajuste", "is", null)
    .lte("proximo_reajuste", limite)
    .limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: reajustes } = await query;

  let alertados = 0;
  for (const r of reajustes ?? []) {
    const { data: existente } = await client
      .from("lead_tarefas")
      .select("id")
      .eq("contrato_id", r.contrato_id)
      .eq("tipo", "reajuste_pendente")
      .eq("status", "pendente")
      .limit(1);
    if (existente && existente.length > 0) continue;

    const corretorId = (r as any).contrato?.corretor_id ?? null;
    const numero = (r as any).contrato?.numero;
    const responsavelUserId = await resolverResponsavel(client, corretorId);

    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: r.tenant_id,
      contrato_id: r.contrato_id,
      responsavel_user_id: responsavelUserId,
      titulo: `Reajuste (${r.indice}) pendente — contrato ${numero ? `#${numero}` : ""}`,
      tipo: "reajuste_pendente",
      prioridade: "media",
      status: "pendente",
      prazo: `${r.proximo_reajuste}T00:00:00`,
    });
    if (!error) alertados++;
  }
  return alertados;
}

async function verificarVistoriasPendentes(
  client: SlaSupabaseClient,
  tenantId?: string,
): Promise<number> {
  const limite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let query = client
    .from("locacao_vistorias")
    .select("id,tenant_id,contrato_id,tipo,data,contrato:contratos(corretor_id,numero)")
    .eq("status", "agendada")
    .lte("data", limite)
    .limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: vistorias } = await query;

  let alertados = 0;
  for (const v of vistorias ?? []) {
    const { data: existente } = await client
      .from("lead_tarefas")
      .select("id")
      .eq("contrato_id", v.contrato_id)
      .eq("tipo", "vistoria_pendente")
      .eq("status", "pendente")
      .limit(1);
    if (existente && existente.length > 0) continue;

    const corretorId = (v as any).contrato?.corretor_id ?? null;
    const numero = (v as any).contrato?.numero;
    const responsavelUserId = await resolverResponsavel(client, corretorId);
    const atrasada = v.data < new Date().toISOString().slice(0, 10);

    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: v.tenant_id,
      contrato_id: v.contrato_id,
      responsavel_user_id: responsavelUserId,
      titulo: `Vistoria (${v.tipo}) ${atrasada ? "atrasada" : "próxima"} — contrato ${numero ? `#${numero}` : ""}`,
      tipo: "vistoria_pendente",
      prioridade: atrasada ? "alta" : "media",
      status: "pendente",
      prazo: `${v.data}T00:00:00`,
    });
    if (!error) alertados++;
  }
  return alertados;
}

async function verificarOrdensServicoAbertas(
  client: SlaSupabaseClient,
  tenantId?: string,
): Promise<number> {
  const limite = new Date(Date.now() - ORDEM_SERVICO_ATRASO_DIAS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let query = client
    .from("locacao_ordens_servico")
    .select("id,tenant_id,contrato_id,titulo,aberta_em,contrato:contratos(corretor_id,numero)")
    .eq("status", "aberta")
    .lte("aberta_em", limite)
    .limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: ordens } = await query;

  let alertados = 0;
  for (const o of ordens ?? []) {
    const { data: existente } = await client
      .from("lead_tarefas")
      .select("id")
      .eq("contrato_id", o.contrato_id)
      .eq("tipo", "ordem_servico_atrasada")
      .eq("status", "pendente")
      .limit(1);
    if (existente && existente.length > 0) continue;

    const corretorId = (o as any).contrato?.corretor_id ?? null;
    const numero = (o as any).contrato?.numero;
    const responsavelUserId = await resolverResponsavel(client, corretorId);

    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: o.tenant_id,
      contrato_id: o.contrato_id,
      responsavel_user_id: responsavelUserId,
      titulo: `Ordem de serviço aberta há mais de ${ORDEM_SERVICO_ATRASO_DIAS} dias: ${o.titulo} — contrato ${numero ? `#${numero}` : ""}`,
      tipo: "ordem_servico_atrasada",
      prioridade: "alta",
      status: "pendente",
    });
    if (!error) alertados++;
  }
  return alertados;
}

async function verificarDocumentosExpirados(
  client: SlaSupabaseClient,
  tenantId?: string,
  enviarEmail?: EnviarEmailAlerta,
): Promise<number> {
  const limite = new Date(Date.now() + ALERTA_ANTECEDENCIA_DIAS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let query = client
    .from("contrato_documentos")
    .select(
      "id,tenant_id,contrato_id,categoria,nome_original,validade,contrato:contratos(corretor_id,numero)",
    )
    .not("validade", "is", null)
    .lte("validade", limite)
    .limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: documentos } = await query;

  let alertados = 0;
  for (const d of documentos ?? []) {
    const { data: existente } = await client
      .from("lead_tarefas")
      .select("id")
      .eq("contrato_id", d.contrato_id)
      .eq("tipo", "documento_expirado")
      .eq("status", "pendente")
      .limit(1);
    if (existente && existente.length > 0) continue;

    const corretorId = (d as any).contrato?.corretor_id ?? null;
    const numero = (d as any).contrato?.numero;
    const responsavelUserId = await resolverResponsavel(client, corretorId);
    const vencido = d.validade < new Date().toISOString().slice(0, 10);
    const titulo = `Documento (${d.categoria}: ${d.nome_original}) ${vencido ? "expirou" : "expira em breve"} — contrato ${numero ? `#${numero}` : ""}`;

    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: d.tenant_id,
      contrato_id: d.contrato_id,
      responsavel_user_id: responsavelUserId,
      titulo,
      tipo: "documento_expirado",
      prioridade: "alta",
      status: "pendente",
      prazo: `${d.validade}T00:00:00`,
    });
    if (!error) {
      alertados++;
      if (enviarEmail) {
        await enviarEmail({
          tenantId: d.tenant_id,
          userId: responsavelUserId,
          subject: titulo,
          html: `<p>${titulo}</p>`,
          label: "documento_expirado",
        });
      }
    }
  }
  return alertados;
}

async function verificarRenovacaoAutomatica(
  client: SlaSupabaseClient,
  tenantId?: string,
): Promise<number> {
  const limite = new Date(Date.now() + ALERTA_ANTECEDENCIA_DIAS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let query = client
    .from("contratos")
    .select("id,tenant_id,numero,corretor_id,data_fim")
    .eq("status", "ativo")
    .eq("renovacao_automatica", true)
    .not("data_fim", "is", null)
    .lte("data_fim", limite)
    .limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: contratos } = await query;

  let alertados = 0;
  for (const c of contratos ?? []) {
    const { data: existente } = await client
      .from("lead_tarefas")
      .select("id")
      .eq("contrato_id", c.id)
      .eq("tipo", "contrato_renovacao_automatica")
      .eq("status", "pendente")
      .limit(1);
    if (existente && existente.length > 0) continue;

    const responsavelUserId = await resolverResponsavel(client, c.corretor_id);
    const numero = c.numero ? `#${c.numero}` : "";

    const { error } = await client.from("lead_tarefas").insert({
      tenant_id: c.tenant_id,
      contrato_id: c.id,
      responsavel_user_id: responsavelUserId,
      titulo: `Contrato ${numero} está marcado para renovação automática e vence em breve — processar a renovação`,
      tipo: "contrato_renovacao_automatica",
      prioridade: "media",
      status: "pendente",
      prazo: `${c.data_fim}T00:00:00`,
    });
    if (!error) alertados++;
  }
  return alertados;
}

export async function runSlaCheck(
  client: SlaSupabaseClient,
  opts?: { tenantId?: string; enviarEmail?: EnviarEmailAlerta },
): Promise<SlaCheckResult> {
  const [
    cartoriosAlertados,
    contratosAlertados,
    garantiasAlertadas,
    reajustesAlertados,
    vistoriasAlertadas,
    ordensServicoAlertadas,
    documentosAlertados,
    renovacoesAlertadas,
  ] = await Promise.all([
    verificarCartoriosParados(client, opts?.tenantId),
    verificarContratosAVencer(client, opts?.tenantId),
    verificarGarantiasVencendo(client, opts?.tenantId),
    verificarReajustesPendentes(client, opts?.tenantId),
    verificarVistoriasPendentes(client, opts?.tenantId),
    verificarOrdensServicoAbertas(client, opts?.tenantId),
    verificarDocumentosExpirados(client, opts?.tenantId, opts?.enviarEmail),
    verificarRenovacaoAutomatica(client, opts?.tenantId),
  ]);
  return {
    cartoriosAlertados,
    contratosAlertados,
    garantiasAlertadas,
    reajustesAlertados,
    vistoriasAlertadas,
    ordensServicoAlertadas,
    documentosAlertados,
    renovacoesAlertadas,
  };
}
