import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Checagem de saúde de cada serviço monitorado no /status e /admin/status
// (ver supabase/migrations/20260728100000_status_page.sql). Os caminhos de
// auth/storage/realtime abaixo foram confirmados um a um via SSH direto na
// VPS de produção antes de escrever este arquivo — só supabase-kong e
// supabase-pooler ficam publicados em 127.0.0.1 no self-host, então todo
// serviço individual (GoTrue, Storage, Realtime) só é alcançável através do
// Kong, na mesma SUPABASE_URL que o resto da app já usa:
//   auth:     GET {SUPABASE_URL}/auth/v1/health         (com apikey) -> 200
//   storage:  GET {SUPABASE_URL}/storage/v1/status       (sem apikey) -> 200
//   realtime: GET {SUPABASE_URL}/realtime/v1/api/ping    (com apikey) -> 200
// (/realtime/v1/api/health e /realtime/v1/ não existem — 404; testado e
// descartado antes de chegar em /api/ping).

export type StatusValue = "operational" | "degraded" | "outage";

export type CheckResult = {
  status: StatusValue;
  latencyMs: number | null;
  mensagem: string | null;
};

async function checkHttp(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 5000,
): Promise<CheckResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const latencyMs = Date.now() - started;
    if (res.ok) return { status: "operational", latencyMs, mensagem: null };
    if (res.status >= 500) {
      return { status: "outage", latencyMs, mensagem: `HTTP ${res.status}` };
    }
    return { status: "degraded", latencyMs, mensagem: `HTTP ${res.status}` };
  } catch (e: any) {
    return {
      status: "outage",
      latencyMs: Date.now() - started,
      mensagem: e?.name === "AbortError" ? "timeout" : (e?.message ?? "falha de conexão"),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkApp(): Promise<CheckResult> {
  // Se este código está rodando é porque o cron alcançou esta rota — a app
  // já respondeu, só por isso não há nenhuma checagem de rede a fazer aqui.
  return { status: "operational", latencyMs: 0, mensagem: null };
}

async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now();
  try {
    const { error } = await supabaseAdmin
      .from("tenants")
      .select("id", { count: "exact", head: true });
    const latencyMs = Date.now() - started;
    if (error) return { status: "outage", latencyMs, mensagem: error.message };
    return { status: "operational", latencyMs, mensagem: null };
  } catch (e: any) {
    return {
      status: "outage",
      latencyMs: Date.now() - started,
      mensagem: e?.message ?? "falha de conexão",
    };
  }
}

function checkAuth(): Promise<CheckResult> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!base || !key) {
    return Promise.resolve({
      status: "outage",
      latencyMs: null,
      mensagem: "SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY ausentes",
    });
  }
  return checkHttp(`${base}/auth/v1/health`, { apikey: key });
}

function checkStorage(): Promise<CheckResult> {
  const base = process.env.SUPABASE_URL;
  if (!base) {
    return Promise.resolve({ status: "outage", latencyMs: null, mensagem: "SUPABASE_URL ausente" });
  }
  return checkHttp(`${base}/storage/v1/status`);
}

function checkRealtime(): Promise<CheckResult> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!base || !key) {
    return Promise.resolve({
      status: "outage",
      latencyMs: null,
      mensagem: "SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY ausentes",
    });
  }
  return checkHttp(`${base}/realtime/v1/api/ping`, { apikey: key });
}

function checkAiAssistant(): Promise<CheckResult> {
  // Só alcançável a partir da própria VPS (127.0.0.1) — em dev (sem Ollama
  // local) isso falha por conexão recusada, o que é esperado e tratado como
  // "outage" (não derruba o resto da checagem, ver executarChecks).
  const base = process.env.OLLAMA_URL || "http://localhost:11434";
  return checkHttp(`${base}/api/tags`, {}, 4000);
}

export const SERVICE_CHECKS: Record<string, () => Promise<CheckResult>> = {
  app: checkApp,
  database: checkDatabase,
  auth: checkAuth,
  storage: checkStorage,
  realtime: checkRealtime,
  "ai-assistant": checkAiAssistant,
};

export type ExecutarChecksResultado = {
  slug: string;
  serviceId: string;
  result: CheckResult;
};

// Roda o checker de cada serviço ativo em status_services e grava o
// resultado em status_checks (mesmo padrão de "grava direto pelo service
// role, RLS não se aplica" já usado em outros crons deste projeto).
export async function executarChecks(): Promise<ExecutarChecksResultado[]> {
  // status_* ainda não está em src/integrations/supabase/types.ts (arquivo
  // gerado, hoje desatualizado em relação ao schema real — mesmo padrão de
  // cast já usado em outros pontos do projeto pra tabelas nessa situação,
  // ex. src/routes/api.public.mercadopago.oauth.callback.ts).
  const { data: services, error } = await (supabaseAdmin as any)
    .from("status_services")
    .select("id,slug")
    .eq("ativo", true);
  if (error || !services) return [];

  const resultados: ExecutarChecksResultado[] = [];
  for (const service of services as { id: string; slug: string }[]) {
    const checker = SERVICE_CHECKS[service.slug];
    if (!checker) continue;
    const result = await checker();
    resultados.push({ slug: service.slug, serviceId: service.id, result });
    await (supabaseAdmin as any).from("status_checks").insert({
      service_id: service.id,
      status: result.status,
      latency_ms: result.latencyMs,
      mensagem: result.mensagem,
      source: "cron",
    });
  }
  return resultados;
}

export type ResumoDiario = { data: string; status: StatusValue | "sem-dado" };

const GRAVIDADE: Record<StatusValue, number> = { operational: 0, degraded: 1, outage: 2 };

// Agrega, por serviço, o pior status observado em cada um dos últimos `dias`
// dias — é o dado que alimenta a faixa histórica estilo Google Status no
// /status e /admin/status. Dias sem nenhuma checagem voltam como "sem-dado"
// (célula neutra na UI, não quebra o layout).
export async function buscarResumoHistorico(serviceId: string, dias = 90): Promise<ResumoDiario[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  const { data } = await (supabaseAdmin as any)
    .from("status_checks")
    .select("status,checked_at")
    .eq("service_id", serviceId)
    .gte("checked_at", desde.toISOString())
    .order("checked_at", { ascending: true });

  const piorPorDia = new Map<string, StatusValue>();
  for (const check of (data ?? []) as { status: StatusValue; checked_at: string }[]) {
    const dia = check.checked_at.slice(0, 10);
    const atual = piorPorDia.get(dia);
    if (!atual || GRAVIDADE[check.status] > GRAVIDADE[atual]) {
      piorPorDia.set(dia, check.status);
    }
  }

  const resultado: ResumoDiario[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const chave = d.toISOString().slice(0, 10);
    resultado.push({ data: chave, status: piorPorDia.get(chave) ?? "sem-dado" });
  }
  return resultado;
}

// Apaga checagens além da janela de retenção (padrão do backup do Postgres:
// find -mtime +N -delete, mesma ideia aqui só que via SQL).
export async function limparChecksAntigos(diasRetencao = 90): Promise<number> {
  const limite = new Date();
  limite.setDate(limite.getDate() - diasRetencao);
  const { error, count } = await (supabaseAdmin as any)
    .from("status_checks")
    .delete({ count: "exact" })
    .lt("checked_at", limite.toISOString());
  if (error) throw error;
  return count ?? 0;
}
