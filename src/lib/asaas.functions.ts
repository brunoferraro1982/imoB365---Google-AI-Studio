import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AsaasError,
  consultarSaldoAsaas,
  criarClienteAsaas,
  type AsaasAmbiente,
  type AsaasClient,
} from "@/integrations/asaas/client.server";

// Configuração do Asaas POR TENANT (boletos de aluguel).
//
// Reutiliza tenant_integracoes_financeiras (sem migration nova):
//   - provider = 'asaas'
//   - tipo     = 'erp'  (NÃO 'conciliacao_bancaria': a tela de conciliação
//                        lista e sobrescreve todas as linhas desse tipo, o que
//                        apagaria a chave salva aqui)
//   - config   = jsonb com ambiente, chave CIFRADA e parâmetros de cobrança
//
// SEGURANÇA:
//   - A chave de API nunca volta ao navegador: só a máscara "••••1234".
//   - A chave é cifrada (AES-256-GCM) antes de ir pro banco. Como a RLS atual
//     permite leitura do config a admin/financeiro, o texto em claro não pode
//     ficar lá. A chave de cifragem é derivada no servidor a partir de
//     SUPABASE_SERVICE_ROLE_KEY (mesmo segredo já usado em mercadopagoOAuth).
//   - O tenant_id é sempre derivado do perfil do usuário autenticado; nunca
//     aceito do cliente.
//   - Leitura/escrita com a chave só em código de servidor.

const PROVIDER = "asaas";
const TIPO = "erp";

// ─── Cifragem da chave de API ─────────────────────────────────────────────

type ChaveCifrada = { v: 1; iv: string; ct: string };

type AsaasConfigJson = {
  ambiente?: AsaasAmbiente;
  api_key_enc?: ChaveCifrada | null;
  api_key_last4?: string | null;
  conta_recebimento?: string;
  multa_percentual?: number;
  juros_mensal_percentual?: number;
  desconto_antecipado_percentual?: number;
  dias_tolerancia?: number;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesParaBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ParaBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Deriva uma chave AES-256 a partir do segredo do servidor (HMAC com rótulo
// fixo). Não usa fallback: sem o segredo, falha alto em vez de cifrar fraco.
async function chaveAes(usos: KeyUsage[]): Promise<CryptoKey> {
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw new Error("Configuração do servidor incompleta.");
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const raw = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    textEncoder.encode("imob365:asaas:api-key:v1"),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, usos);
}

async function cifrarChave(texto: string): Promise<ChaveCifrada> {
  const key = await chaveAes(["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(texto));
  return { v: 1, iv: bytesParaBase64(iv), ct: bytesParaBase64(new Uint8Array(ct)) };
}

async function decifrarChave(cifrada: ChaveCifrada): Promise<string> {
  if (cifrada?.v !== 1 || typeof cifrada.iv !== "string" || typeof cifrada.ct !== "string") {
    throw new Error("Formato de chave inválido");
  }
  const key = await chaveAes(["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ParaBytes(cifrada.iv) as BufferSource },
    key,
    base64ParaBytes(cifrada.ct) as BufferSource,
  );
  return textDecoder.decode(pt);
}

// ─── Auth / tenant ────────────────────────────────────────────────────────

async function resolveTenantId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Usuário sem imobiliária vinculada");
  return profile.tenant_id as string;
}

// Quem pode gerenciar Configurações (matriz: admin e super_admin, ajustes.config).
async function exigirGestorConfiguracoes(supabase: any, userId: string, tenantId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role_in_tenant", {
    _user_id: userId,
    _tenant_id: tenantId,
    _role: "admin",
  });
  const { data: isSuper } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!isAdmin && !isSuper) {
    throw new Error("Apenas administradores podem gerenciar a integração com o Asaas");
  }
}

type LinhaIntegracao = {
  id: string;
  nome_exibicao: string;
  config: AsaasConfigJson;
  ativo: boolean;
};

async function lerLinhaAsaas(supabase: any, tenantId: string): Promise<LinhaIntegracao | null> {
  const { data, error } = await supabase
    .from("tenant_integracoes_financeiras")
    .select("id,nome_exibicao,config,ativo")
    .eq("tenant_id", tenantId)
    .eq("provider", PROVIDER)
    .eq("tipo", TIPO)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar a configuração do Asaas.");
  return (data as LinhaIntegracao | null) ?? null;
}

// ─── Schemas (Zod, validação no servidor) ─────────────────────────────────

const percentual = z
  .number({ invalid_type_error: "Valor inválido" })
  .min(0, "Não pode ser negativo")
  .max(100, "Máximo de 100%");

export const salvarAsaasInput = z.object({
  ambiente: z.enum(["sandbox", "producao"]),
  // Vazio/ausente = manter a chave já salva. Não é exibida de volta ao cliente.
  apiKey: z
    .string()
    .trim()
    .max(300, "Chave de API muito longa")
    .regex(/^[\x21-\x7E]*$/, "Chave contém caracteres inválidos")
    .refine((v) => v === "" || v.length >= 10, "Chave de API muito curta")
    .optional(),
  nomeExibicao: z.string().trim().min(2, "Informe um nome").max(80),
  contaRecebimento: z.string().trim().max(120),
  multaPercentual: percentual,
  jurosMensalPercentual: percentual,
  descontoAntecipadoPercentual: percentual,
  diasTolerancia: z.number().int("Use um número inteiro").min(0).max(60),
  ativo: z.boolean(),
});

export type SalvarAsaasInput = z.infer<typeof salvarAsaasInput>;

// ─── Server functions ─────────────────────────────────────────────────────

export type AsaasConfigView = {
  existe: boolean;
  ativo: boolean;
  nomeExibicao: string;
  ambiente: AsaasAmbiente;
  apiKeyMascarada: string | null;
  contaRecebimento: string;
  multaPercentual: number;
  jurosMensalPercentual: number;
  descontoAntecipadoPercentual: number;
  diasTolerancia: number;
};

export type TesteConexaoAsaas = { conectado: boolean; mensagem: string };

export const obterConfigAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AsaasConfigView> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await exigirGestorConfiguracoes(supabase, userId, tenantId);
    const linha = await lerLinhaAsaas(supabase, tenantId);
    const cfg: AsaasConfigJson = linha?.config ?? {};

    return {
      existe: !!linha,
      ativo: linha?.ativo ?? false,
      nomeExibicao: linha?.nome_exibicao ?? "Asaas",
      ambiente: cfg.ambiente ?? "sandbox",
      apiKeyMascarada: cfg.api_key_enc && cfg.api_key_last4 ? `••••${cfg.api_key_last4}` : null,
      contaRecebimento: cfg.conta_recebimento ?? "",
      multaPercentual: cfg.multa_percentual ?? 2,
      jurosMensalPercentual: cfg.juros_mensal_percentual ?? 1,
      descontoAntecipadoPercentual: cfg.desconto_antecipado_percentual ?? 0,
      diasTolerancia: cfg.dias_tolerancia ?? 0,
    };
  });

export const salvarConfigAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(salvarAsaasInput)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await exigirGestorConfiguracoes(supabase, userId, tenantId);

    const linha = await lerLinhaAsaas(supabase, tenantId);
    const atual: AsaasConfigJson = linha?.config ?? {};

    let apiKeyEnc = atual.api_key_enc ?? null;
    let last4 = atual.api_key_last4 ?? null;
    if (data.apiKey) {
      apiKeyEnc = await cifrarChave(data.apiKey);
      last4 = data.apiKey.slice(-4);
    }
    if (data.ativo && !apiKeyEnc) {
      throw new Error("Informe a chave de API antes de ativar a integração.");
    }

    const config: AsaasConfigJson = {
      ambiente: data.ambiente,
      api_key_enc: apiKeyEnc,
      api_key_last4: last4,
      conta_recebimento: data.contaRecebimento,
      multa_percentual: data.multaPercentual,
      juros_mensal_percentual: data.jurosMensalPercentual,
      desconto_antecipado_percentual: data.descontoAntecipadoPercentual,
      dias_tolerancia: data.diasTolerancia,
    };

    const erroSalvar = new Error("Não foi possível salvar a configuração do Asaas.");

    if (linha) {
      const { error } = await supabase
        .from("tenant_integracoes_financeiras")
        .update({ nome_exibicao: data.nomeExibicao, config, ativo: data.ativo })
        .eq("id", linha.id)
        .eq("tenant_id", tenantId);
      if (error) throw erroSalvar;
    } else {
      const { error } = await supabase.from("tenant_integracoes_financeiras").insert({
        tenant_id: tenantId,
        tipo: TIPO,
        provider: PROVIDER,
        nome_exibicao: data.nomeExibicao,
        config,
        ativo: data.ativo,
        created_by: userId,
      });
      if (error) throw erroSalvar;
    }

    return { ok: true };
  });

export const testarConexaoAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TesteConexaoAsaas> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await exigirGestorConfiguracoes(supabase, userId, tenantId);

    const linha = await lerLinhaAsaas(supabase, tenantId);
    const cfg: AsaasConfigJson = linha?.config ?? {};
    if (!cfg.api_key_enc) {
      return {
        conectado: false,
        mensagem: "Nenhuma chave de API salva. Salve a configuração antes de testar.",
      };
    }

    let apiKey: string;
    try {
      apiKey = await decifrarChave(cfg.api_key_enc);
    } catch {
      return {
        conectado: false,
        mensagem: "Não foi possível ler a chave salva. Informe a chave novamente e salve.",
      };
    }

    try {
      await consultarSaldoAsaas(criarClienteAsaas({ apiKey, ambiente: cfg.ambiente ?? "sandbox" }));
      return { conectado: true, mensagem: "Conectado" };
    } catch (err) {
      const mensagem =
        err instanceof AsaasError ? err.message : "Não foi possível testar a conexão com o Asaas.";
      return { conectado: false, mensagem };
    }
  });

// ─── Uso interno (próximas etapas: criação de boletos) ────────────────────
//
// NÃO é server function: roda só no servidor, com service role e filtro
// explícito por tenant_id. Quem chama já deve ter validado o contexto
// (ex.: job de cobrança de aluguel, webhook). Lança erro se o tenant não
// tiver integração Asaas ativa.

export type ClienteAsaasDoTenant = {
  cliente: AsaasClient;
  ambiente: AsaasAmbiente;
  contaRecebimento: string;
  multaPercentual: number;
  jurosMensalPercentual: number;
  descontoAntecipadoPercentual: number;
  diasTolerancia: number;
};

export async function getClienteAsaasDoTenant(tenantId: string): Promise<ClienteAsaasDoTenant> {
  const tenant = z.string().uuid().parse(tenantId);

  const { data, error } = await (supabaseAdmin as any)
    .from("tenant_integracoes_financeiras")
    .select("ativo,config")
    .eq("tenant_id", tenant)
    .eq("provider", PROVIDER)
    .eq("tipo", TIPO)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Falha ao carregar a integração Asaas do tenant.");
  if (!data?.ativo) throw new Error("Integração Asaas não está ativa para este tenant.");

  const cfg = (data.config ?? {}) as AsaasConfigJson;
  if (!cfg.api_key_enc) throw new Error("Integração Asaas sem chave de API configurada.");

  const apiKey = await decifrarChave(cfg.api_key_enc);
  const ambiente: AsaasAmbiente = cfg.ambiente ?? "sandbox";

  return {
    cliente: criarClienteAsaas({ apiKey, ambiente }),
    ambiente,
    contaRecebimento: cfg.conta_recebimento ?? "",
    multaPercentual: cfg.multa_percentual ?? 2,
    jurosMensalPercentual: cfg.juros_mensal_percentual ?? 1,
    descontoAntecipadoPercentual: cfg.desconto_antecipado_percentual ?? 0,
    diasTolerancia: cfg.dias_tolerancia ?? 0,
  };
}
