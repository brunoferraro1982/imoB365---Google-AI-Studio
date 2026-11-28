// Cliente HTTP mínimo da API do Asaas (server-only). Usa fetch nativo, sem SDK.
//
// SEGURANÇA: a chave de API do tenant é segredo. Este módulo recebe a chave já
// descriptografada pelo chamador (server function) e NUNCA a devolve, loga ou
// inclui em mensagens de erro. Erros carregam só um resumo legível + status HTTP.
//
// Nenhuma chamada real é feita em desenvolvimento sem chave configurada pelo
// tenant — este arquivo só define a infra para uso futuro (ex.: geração de boletos).

export type AsaasAmbiente = "sandbox" | "producao";

export const ASAAS_BASE_URL: Record<AsaasAmbiente, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
};

export const ASAAS_TIMEOUT_MS = 10_000;

export class AsaasError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

export interface AsaasClient {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body: unknown): Promise<T>;
}

export interface AsaasClientOptions {
  apiKey: string;
  ambiente: AsaasAmbiente;
  timeoutMs?: number;
}

// Resumo amigável por status HTTP. Nunca inclui o corpo da resposta da API
// (poderia ecoar dados sensíveis); só o status e uma mensagem fixa.
function mensagemPorStatus(status: number): string {
  if (status === 401) {
    return "Chave de API inválida ou não autorizada para este ambiente (HTTP 401). Verifique a chave e se o ambiente (Sandbox/Produção) é o correto.";
  }
  if (status === 403) {
    return "A chave de API não tem permissão para esta operação (HTTP 403).";
  }
  if (status === 429) {
    return "Limite de requisições do Asaas atingido (HTTP 429). Tente novamente em instantes.";
  }
  if (status >= 500) {
    return `O Asaas respondeu com erro interno (HTTP ${status}). Tente novamente mais tarde.`;
  }
  return `O Asaas recusou a requisição (HTTP ${status}).`;
}

export function criarClienteAsaas(options: AsaasClientOptions): AsaasClient {
  const { apiKey, ambiente } = options;
  const timeoutMs = options.timeoutMs ?? ASAAS_TIMEOUT_MS;
  const baseUrl = ASAAS_BASE_URL[ambiente];

  async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          access_token: apiKey,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "imob365",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AsaasError(mensagemPorStatus(response.status), response.status);
      }
      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof AsaasError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AsaasError(
          `O Asaas não respondeu em ${Math.round(timeoutMs / 1000)} segundos.`,
          null,
        );
      }
      throw new AsaasError("Não foi possível conectar à API do Asaas.", null);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: <T = unknown>(path: string) => request<T>("GET", path),
    post: <T = unknown>(path: string, body: unknown) => request<T>("POST", path, body),
  };
}

// Resposta mínima de GET /v3/finance/balance (usada pelo "Testar conexão").
export interface AsaasBalanceResponse {
  balance: number;
}

export function consultarSaldoAsaas(client: AsaasClient): Promise<AsaasBalanceResponse> {
  return client.get<AsaasBalanceResponse>("/finance/balance");
}
