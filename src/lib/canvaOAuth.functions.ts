import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Conexão OAuth por tenant com a Canva — CADA TENANT TEM O PRÓPRIO APP
// (Client ID + Secret, criado pelo próprio tenant no painel de
// desenvolvedor da Canva, colado na tela app.portais.canva.tsx), não um
// app único compartilhado pelo imoB365. Mesmo motivo do padrão já usado
// em metaOAuth.functions.ts: uma integração "Pública" (visível pra
// qualquer usuário Canva do mundo) exige revisão da própria Canva, sem
// SLA definido — uma integração "Privada" (só pra quem criou) não passa
// por revisão nenhuma e funciona na hora, exatamente como o app Meta de
// cada tenant já funciona hoje.
//
// Diferença real de protocolo em relação à Meta: a Canva EXIGE PKCE
// (code_verifier/code_challenge, S256) além do client_secret — a Meta não
// usa PKCE. Como o code_verifier precisa sobreviver entre a chamada que
// gera a URL de autorização e o callback (duas requisições HTTP
// separadas, sem estado de servidor em comum), ele viaja embutido dentro
// do próprio `state` assinado por HMAC — mesma técnica já usada em
// metaOAuth.functions.ts pra levar o tenant_id, só com um campo a mais.

const STATE_TTL_MS = 10 * 60 * 1000;
const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const CANVA_SCOPES = "asset:read asset:write design:content:read design:content:write";

// HMAC via Web Crypto (crypto.subtle) em vez de node:crypto — este arquivo
// é um *.functions.ts, bundlado pro client também; node:crypto não existe
// no browser e quebraria esse bundle. Mesmo padrão de metaOAuth.functions.ts.
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "=");
  const binary = atob(withPad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Base64 padrão (com +/= , não base64url) — é o que o header
// "Authorization: Basic" exige (RFC 7617). `btoa` já produz esse alfabeto
// nativamente, sem precisar de node:crypto/Buffer (evita quebrar o bundle
// client, mesmo motivo documentado no topo do arquivo).
function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
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

type StatePayload = { tenantId: string; codeVerifier: string; ts: number };

async function signState(payload: Omit<StatePayload, "ts">): Promise<string> {
  const full: StatePayload = { ...payload, ts: Date.now() };
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(full)));
  const key = await getHmacKey();
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64urlEncode(new Uint8Array(sigBuffer))}`;
}

export async function verifyCanvaOAuthState(state: string): Promise<StatePayload | null> {
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
    const parsed = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadB64)),
    ) as StatePayload;
    if (Date.now() - parsed.ts > STATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

// code_verifier — string aleatória de alta entropia (43-128 chars,
// RFC 7636); code_challenge = base64url(sha256(code_verifier)).
function gerarCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return base64urlEncode(bytes);
}

async function gerarCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64urlEncode(new Uint8Array(digest));
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
    throw new Error("Apenas administradores da imobiliária podem gerenciar a conexão com a Canva");
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

export type CanvaConnectionStatus = {
  appConfigured: boolean;
  connected: boolean;
  connectedAt: string | null;
};

export const getCanvaConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CanvaConnectionStatus> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

    const { data } = await (supabaseAdmin as any)
      .from("tenant_canva_connections")
      .select("client_id,client_secret,access_token,connected_at")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    return {
      appConfigured: !!data?.client_id && !!data?.client_secret,
      connected: !!data?.access_token,
      connectedAt: data?.connected_at ?? null,
    };
  });

const salvarCanvaAppCredentialsSchema = z.object({
  clientId: z.string().trim().min(5, "Client ID inválido").max(80),
  clientSecret: z.string().trim().min(10, "Client Secret inválido").max(120),
});

// Passo 1 do wizard (app.portais.canva.tsx): o tenant cola o Client
// ID/Secret da PRÓPRIA integração Canva (criada no próprio painel de
// desenvolvedor dele) — ainda não conecta a conta, só registra as
// credenciais que o getCanvaAuthorizeUrl abaixo vai usar.
export const salvarCanvaAppCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => salvarCanvaAppCredentialsSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_canva_connections")
      .upsert(
        { tenant_id: tenantId, client_id: data.clientId, client_secret: data.clientSecret },
        { onConflict: "tenant_id" },
      );
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// Reinício completo — apaga client_id/client_secret junto com qualquer
// token existente. Diferente de disconnectCanva (que só desconecta a
// conta, preservando o App já configurado).
export const removerCanvaAppCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_canva_connections")
      .delete()
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const getCanvaAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL não configurada");

    const { data: conexao } = await (supabaseAdmin as any)
      .from("tenant_canva_connections")
      .select("client_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!conexao?.client_id) {
      throw new Error("Configure seu App da Canva (Client ID/Secret) antes de conectar a conta");
    }

    const codeVerifier = gerarCodeVerifier();
    const codeChallenge = await gerarCodeChallenge(codeVerifier);
    const state = await signState({ tenantId, codeVerifier });

    const redirectUri = `${appUrl}/api/public/canva/oauth/callback`;
    const url = new URL(CANVA_AUTHORIZE_URL);
    url.searchParams.set("client_id", conexao.client_id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", CANVA_SCOPES);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "s256");
    url.searchParams.set("state", state);

    return { url: url.toString() };
  });

// Troca `code` por access_token/refresh_token — chamado pelo callback
// (api.public.canva.oauth.callback.ts), nunca direto pelo client.
export async function trocarCodePorToken(
  clientId: string,
  clientSecret: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const basic = base64Encode(new TextEncoder().encode(`${clientId}:${clientSecret}`));
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    throw new Error(
      json?.error_description || json?.error || `Falha ao trocar code por token (${res.status})`,
    );
  }
  return json;
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const basic = base64Encode(new TextEncoder().encode(`${clientId}:${clientSecret}`));
  const params = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    throw new Error(
      json?.error_description || json?.error || `Falha ao renovar token (${res.status})`,
    );
  }
  return json;
}

// Usado por canvaDesign.functions.ts antes de qualquer chamada à API da
// Canva — a Canva exige token novo periodicamente (expires_in curto) e
// "cada refresh_token só pode ser usado uma vez" (doc oficial), então o
// token renovado E o novo refresh_token são sempre persistidos de volta
// antes de retornar, nunca só em memória.
export async function getValidCanvaAccessToken(tenantId: string): Promise<string> {
  const { data } = await (supabaseAdmin as any)
    .from("tenant_canva_connections")
    .select("client_id,client_secret,access_token,refresh_token,token_expires_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error("Conecte sua conta Canva antes de editar (Portais → Canva).");
  }
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (Date.now() < expiresAt - 60_000) return data.access_token;

  const refreshed = await refreshAccessToken(
    data.client_id,
    data.client_secret,
    data.refresh_token,
  );
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await (supabaseAdmin as any)
    .from("tenant_canva_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq("tenant_id", tenantId);
  return refreshed.access_token;
}

// Desconecta só a conta (volta pro estado "App configurado, sem conta
// conectada") — preserva client_id/client_secret pra não obrigar o
// tenant a redigitar tudo só pra reconectar.
export const disconnectCanva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_canva_connections")
      .update({
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        canva_user_id: null,
        connected_at: null,
      })
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
