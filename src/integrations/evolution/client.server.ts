// Cliente server-only da Evolution API (WhatsApp) — BYO por tenant.
// SECURITY: a chave de API da instância é segredo do tenant. Este arquivo
// só deve ser importado por server functions / rotas de servidor. Nunca
// devolver `apiKey` ao navegador: a UI recebe apenas máscara.
//
// Endpoints usados (contrato público da Evolution API v2):
//   GET {url}/instance/connectionState/{instance}  header `apikey`
//   GET {url}/instance/fetchInstances?instanceName={instance}  (número, best-effort)
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const EVOLUTION_TIMEOUT_MS = 10_000;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// IPs literais privados/link-local/loopback não são aceitos em https — evita
// que o servidor da imoB365 seja usado para sondar a rede interna (SSRF).
const IPV4_BLOQUEADO =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/**
 * Valida a URL base da Evolution API.
 * - somente https://, exceto http://localhost fora de produção (dev);
 * - sem credenciais embutidas, query ou fragmento;
 * - IPs privados/loopback literais bloqueados;
 * - devolve a URL normalizada (sem barra final).
 */
export const evolutionBaseUrlSchema = z
  .string()
  .trim()
  .min(1, "Informe a URL da instância")
  .max(300, "URL muito longa")
  .transform((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL inválida" });
      return z.NEVER;
    }
    const isLocalDev = url.protocol === "http:" && url.hostname === "localhost" && !IS_PRODUCTION;
    if (url.protocol !== "https:" && !isLocalDev) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A URL precisa usar https:// (http:// só é aceito para localhost em desenvolvimento)",
      });
      return z.NEVER;
    }
    if (url.username || url.password || url.search || url.hash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A URL não pode conter credenciais, query string ou fragmento",
      });
      return z.NEVER;
    }
    if (
      url.protocol === "https:" &&
      (IPV4_BLOQUEADO.test(url.hostname) || url.hostname === "[::1]")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Endereços de rede privada não são aceitos; use um domínio público",
      });
      return z.NEVER;
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  });

export const evolutionInstanceNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome da instância")
  .max(80)
  .regex(/^[A-Za-z0-9_.-]+$/, "Use apenas letras, números, ponto, hífen ou underscore");

/** Configuração gravada em tenant_atendimento_canal_config (canal = 'whatsapp'). */
export type EvolutionCanalConfig = {
  instance_url?: string | null;
  instance_name?: string | null;
  api_key?: string | null;
  numero?: string | null;
  numero_conectado?: string | null;
  mensagem_boas_vindas?: string | null;
};

export type EvolutionTestResult =
  | { estado: "conectado"; mensagem: string; numeroConectado: string | null }
  | { estado: "desconectado"; mensagem: string }
  | { estado: "erro"; mensagem: string };

export function mascararChave(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  const fim = apiKey.slice(-4);
  return `••••••••${fim}`;
}

async function evolutionGet(
  baseUrl: string,
  apiKey: string,
  path: string,
): Promise<{ status: number; json: unknown } | { erroRede: true }> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: { apikey: apiKey, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(EVOLUTION_TIMEOUT_MS),
    });
    // O corpo nunca é repassado (pode ecoar a chave); só o JSON estrutural é lido.
    const json = res.ok ? await res.json().catch(() => null) : null;
    return { status: res.status, json };
  } catch {
    return { erroRede: true };
  }
}

function extrairNumeroDoJid(json: unknown, instanceName: string): string | null {
  if (!Array.isArray(json)) return null;
  const inst = json.find(
    (i) => i && typeof i === "object" && (i as { name?: unknown }).name === instanceName,
  ) as { ownerJid?: unknown } | undefined;
  const jid = typeof inst?.ownerJid === "string" ? inst.ownerJid : null;
  if (!jid) return null;
  const digitos = jid.split("@")[0].replace(/\D/g, "");
  return digitos || null;
}

/**
 * Consulta o estado da instância. Nunca lança: devolve estado + mensagem
 * resumida, sem expor a chave nem o corpo bruto da resposta.
 */
export async function testarConexaoEvolution(input: {
  baseUrl: string;
  instanceName: string;
  apiKey: string;
}): Promise<EvolutionTestResult> {
  const instancia = encodeURIComponent(input.instanceName);
  const estadoRes = await evolutionGet(
    input.baseUrl,
    input.apiKey,
    `/instance/connectionState/${instancia}`,
  );

  if ("erroRede" in estadoRes) {
    return {
      estado: "erro",
      mensagem: "Não foi possível alcançar a URL informada (tempo esgotado ou host inacessível)",
    };
  }
  if (estadoRes.status === 401 || estadoRes.status === 403) {
    return { estado: "erro", mensagem: "Chave de API recusada pela Evolution API" };
  }
  if (estadoRes.status === 404) {
    return { estado: "erro", mensagem: "Instância não encontrada com esse nome" };
  }
  if (estadoRes.status < 200 || estadoRes.status >= 300) {
    return { estado: "erro", mensagem: `Evolution API respondeu com status ${estadoRes.status}` };
  }

  const state = (estadoRes.json as { instance?: { state?: unknown } } | null)?.instance?.state;
  if (state !== "open") {
    const mensagem =
      state === "connecting"
        ? "Instância ainda conectando (aguardando leitura do QR Code)"
        : "Instância desconectada";
    return { estado: "desconectado", mensagem };
  }

  // Número conectado: best-effort, somente leitura. Falha aqui não rebaixa o teste.
  const listaRes = await evolutionGet(
    input.baseUrl,
    input.apiKey,
    `/instance/fetchInstances?instanceName=${instancia}`,
  );
  const numeroConectado =
    "erroRede" in listaRes ? null : extrairNumeroDoJid(listaRes.json, input.instanceName);

  return { estado: "conectado", mensagem: "Instância conectada", numeroConectado };
}

export type ClienteEvolutionTenant = {
  instanceUrl: string;
  instanceName: string;
  apiKey: string;
  numero: string | null;
  mensagemBoasVindas: string | null;
  testarConexao: () => Promise<EvolutionTestResult>;
};

/**
 * Carrega o cliente Evolution do tenant (uso server-side, ex.: régua de
 * cobrança futura). Retorna null se o canal não existir, estiver inativo
 * ou sem URL/instância/chave. Não envia mensagens por si só.
 */
export async function getClienteEvolutionDoTenant(
  tenantId: string,
): Promise<ClienteEvolutionTenant | null> {
  const { data } = await supabaseAdmin
    .from("tenant_atendimento_canal_config")
    .select("config,ativo")
    .eq("tenant_id", tenantId)
    .eq("canal", "whatsapp")
    .maybeSingle();
  if (!data?.ativo) return null;

  const cfg = (data.config ?? {}) as EvolutionCanalConfig;
  if (!cfg.instance_url || !cfg.instance_name || !cfg.api_key) return null;

  const instanceUrl = cfg.instance_url;
  const instanceName = cfg.instance_name;
  const apiKey = cfg.api_key;
  return {
    instanceUrl,
    instanceName,
    apiKey,
    numero: cfg.numero ?? null,
    mensagemBoasVindas: cfg.mensagem_boas_vindas ?? null,
    testarConexao: () => testarConexaoEvolution({ baseUrl: instanceUrl, instanceName, apiKey }),
  };
}
