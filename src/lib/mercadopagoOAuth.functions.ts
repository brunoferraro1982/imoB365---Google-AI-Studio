import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Conexão OAuth por tenant com o Mercado Pago Marketplace (Fase 3 do
// incremento do módulo Financeiro) — distinto do MERCADOPAGO_ACCESS_TOKEN já
// existente no projeto (esse é da própria plataforma, cobra a assinatura
// SaaS do tenant). Aqui cada tenant conecta a PRÓPRIA conta MP via OAuth,
// pra depois cobrar PIX/boleto/cartão do cliente final da imobiliária —
// ver supabase/migrations/20260727160000_mercadopago_marketplace_oauth.sql.
//
// A criação da cobrança em si (usando esse token + application_fee) e o
// webhook de confirmação ficam pra uma próxima etapa — este arquivo cobre
// só conectar/desconectar e consultar status.

const STATE_TTL_MS = 10 * 60 * 1000; // mesma validade do authorization code do MP (10 min)

// HMAC via Web Crypto (crypto.subtle) em vez de node:crypto — este arquivo é
// um *.functions.ts, e o compilador do TanStack Start só sabe extrair pro
// bundle do servidor as funções empacotadas em createServerFn; uma função
// solta usando node:crypto (só existe no Node, não no browser) quebrava o
// build do client ao ser importada pela rota do callback.
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "=");
  const binary = atob(withPad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// state assinado (HMAC) carregando o tenant_id — evita precisar de uma
// tabela nova só pra guardar "conexões pendentes"; a assinatura garante que
// o valor não foi adulterado no round-trip pelo Mercado Pago.
async function signState(tenantId: string): Promise<string> {
  const payloadB64 = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ tenantId, ts: Date.now() })),
  );
  const key = await getHmacKey();
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64urlEncode(new Uint8Array(sigBuffer))}`;
}

export async function verifyMercadoPagoOAuthState(
  state: string,
): Promise<{ tenantId: string } | null> {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return null;
  const key = await getHmacKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(sig) as BufferSource,
    new TextEncoder().encode(payloadB64),
  );
  if (!valid) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as {
      tenantId: string;
      ts: number;
    };
    if (Date.now() - parsed.ts > STATE_TTL_MS) return null;
    return { tenantId: parsed.tenantId };
  } catch {
    return null;
  }
}

async function requireTenantAdmin(supabase: any, userId: string, tenantId: string) {
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
    throw new Error(
      "Apenas administradores da imobiliária podem gerenciar a conexão com o Mercado Pago",
    );
  }
}

async function resolveTenantId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Usuário sem imobiliária vinculada");
  return profile.tenant_id;
}

export type MercadoPagoConnectionStatus = {
  connected: boolean;
  connectedAt: string | null;
  expiresAt: string | null;
  liveMode: boolean | null;
};

export const getMercadoPagoConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MercadoPagoConnectionStatus> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

    const { data } = await (supabaseAdmin as any)
      .from("tenant_mercadopago_accounts")
      .select("connected_at,expires_at,live_mode")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    return {
      connected: !!data,
      connectedAt: data?.connected_at ?? null,
      expiresAt: data?.expires_at ?? null,
      liveMode: data?.live_mode ?? null,
    };
  });

export const getMercadoPagoAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const clientId = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID;
    const appUrl = process.env.APP_URL;
    if (!clientId || !appUrl) {
      throw new Error(
        "Integração com Mercado Pago Marketplace não configurada (MERCADOPAGO_MARKETPLACE_CLIENT_ID/APP_URL ausentes)",
      );
    }

    const redirectUri = `${appUrl}/api/public/mercadopago/oauth/callback`;
    const state = await signState(tenantId);
    const url = new URL("https://auth.mercadopago.com/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("platform_id", "mp");
    url.searchParams.set("scope", "read write offline_access");
    url.searchParams.set("state", state);

    return { url: url.toString() };
  });

export const disconnectMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_mercadopago_accounts")
      .delete()
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
