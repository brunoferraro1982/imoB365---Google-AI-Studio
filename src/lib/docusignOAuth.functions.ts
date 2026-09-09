import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Conexão OAuth por tenant com o DocuSign — CADA TENANT TEM A PRÓPRIA
// Integration Key (criada pelo próprio tenant em suas Configurações de App
// e Chaves do DocuSign), não uma conta operada pela imoB365. Mesmo padrão
// já usado em metaOAuth.functions.ts/canvaOAuth.functions.ts.
//
// Diferença real de protocolo: o DocuSign usa Authorization Code Grant
// clássico (sem PKCE) — Basic auth com client_id:client_secret na troca de
// code por token, igual à Canva, mas sem code_verifier. Endpoints e
// formato confirmados lendo o código-fonte real do SDK oficial
// (docusign-esign-node-client — src/oauth/BasePath.js, src/ApiClient.js),
// não só a documentação em prosa (que estava com JS renderizado demais
// pra extrair via fetch simples).
//
// Achado real: diferente de Meta ("Privada") e Canva ("Privada"), o
// DocuSign exige uma etapa de "Go-Live" (promoção da Integration Key do
// ambiente de demonstração pro de produção) mesmo quando ela só vai ser
// usada com UMA única conta — não existe isenção de review por ser
// "conta única", só um fluxo simplificado sem mais o requisito antigo de
// 20 chamadas de API consecutivas. Documentado no wizard e no guia da
// Central de Ajuda.

const STATE_TTL_MS = 10 * 60 * 1000;
const DOCUSIGN_AUTH_HOST = "account.docusign.com";
const DOCUSIGN_SCOPES = "signature";

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

// Base64 padrão (não base64url) — o que "Authorization: Basic" exige
// (RFC 7617). `btoa` já produz esse alfabeto sem precisar de node:crypto,
// que quebraria o bundle client deste arquivo *.functions.ts.
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

type StatePayload = { tenantId: string; ts: number };

async function signState(payload: Omit<StatePayload, "ts">): Promise<string> {
  const full: StatePayload = { ...payload, ts: Date.now() };
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(full)));
  const key = await getHmacKey();
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64urlEncode(new Uint8Array(sigBuffer))}`;
}

export async function verifyDocusignOAuthState(state: string): Promise<StatePayload | null> {
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
      "Apenas administradores da imobiliária podem gerenciar a conexão com o DocuSign",
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

export type DocusignConnectionStatus = {
  appConfigured: boolean;
  connected: boolean;
  connectedAt: string | null;
  accountName: string | null;
};

export const getDocusignConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocusignConnectionStatus> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

    const { data } = await (supabaseAdmin as any)
      .from("tenant_docusign_connections")
      .select("client_id,client_secret,access_token,connected_at,account_name")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    return {
      appConfigured: !!data?.client_id && !!data?.client_secret,
      connected: !!data?.access_token,
      connectedAt: data?.connected_at ?? null,
      accountName: data?.account_name ?? null,
    };
  });

const salvarDocusignAppCredentialsSchema = z.object({
  clientId: z.string().trim().min(10, "Integration Key inválida").max(80),
  clientSecret: z.string().trim().min(10, "Secret Key inválida").max(120),
});

export const salvarDocusignAppCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => salvarDocusignAppCredentialsSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_docusign_connections")
      .upsert(
        { tenant_id: tenantId, client_id: data.clientId, client_secret: data.clientSecret },
        { onConflict: "tenant_id" },
      );
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const removerDocusignAppCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_docusign_connections")
      .delete()
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const getDocusignAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL não configurada");

    const { data: conexao } = await (supabaseAdmin as any)
      .from("tenant_docusign_connections")
      .select("client_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!conexao?.client_id) {
      throw new Error("Configure sua Integration Key do DocuSign antes de conectar a conta");
    }

    const state = await signState({ tenantId });
    const redirectUri = `${appUrl}/api/public/docusign/oauth/callback`;
    const url = new URL(`https://${DOCUSIGN_AUTH_HOST}/oauth/auth`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", DOCUSIGN_SCOPES);
    url.searchParams.set("client_id", conexao.client_id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    return { url: url.toString() };
  });

type DocusignToken = { access_token: string; refresh_token: string; expires_in: number };

// Troca `code` por access_token/refresh_token — chamado pelo callback
// (api.public.docusign.oauth.callback.ts), nunca direto pelo client.
export async function trocarCodePorToken(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<DocusignToken> {
  const basic = base64Encode(new TextEncoder().encode(`${clientId}:${clientSecret}`));
  const params = new URLSearchParams({ grant_type: "authorization_code", code });
  const res = await fetch(`https://${DOCUSIGN_AUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-store",
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
): Promise<DocusignToken> {
  const basic = base64Encode(new TextEncoder().encode(`${clientId}:${clientSecret}`));
  const params = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const res = await fetch(`https://${DOCUSIGN_AUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-store",
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

export type DocusignAccount = {
  account_id: string;
  is_default: string | boolean;
  account_name: string;
  base_uri: string;
};

// /oauth/userinfo — confirmado no SDK oficial (src/oauth/Account.js) que os
// campos vêm em snake_case: account_id, is_default, account_name, base_uri.
export async function buscarUserInfo(
  accessToken: string,
): Promise<{ sub: string; accounts: DocusignAccount[] }> {
  const res = await fetch(`https://${DOCUSIGN_AUTH_HOST}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Cache-Control": "no-store" },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.accounts?.length) {
    throw new Error("Não foi possível obter as contas DocuSign do usuário conectado.");
  }
  return json;
}

// Usado antes de qualquer chamada à API do DocuSign — access_token tem
// vida curta (tipicamente ~8h); refresh_token do DocuSign, diferente da
// Canva, não é invalidado a cada uso (pode ser reutilizado até expirar,
// ~30 dias de inatividade), mas persistimos o novo token mesmo assim por
// segurança e para renovar a validade da sessão de refresh.
export async function getValidDocusignAccessToken(
  tenantId: string,
): Promise<{ accessToken: string; accountId: string; baseUri: string }> {
  const { data } = await (supabaseAdmin as any)
    .from("tenant_docusign_connections")
    .select(
      "client_id,client_secret,access_token,refresh_token,token_expires_at,account_id,base_uri",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data?.access_token || !data?.refresh_token || !data?.account_id || !data?.base_uri) {
    throw new Error(
      "Conecte sua conta DocuSign antes de enviar pra assinatura (Configurações → Assinatura eletrônica).",
    );
  }
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (Date.now() < expiresAt - 60_000) {
    return { accessToken: data.access_token, accountId: data.account_id, baseUri: data.base_uri };
  }

  const refreshed = await refreshAccessToken(
    data.client_id,
    data.client_secret,
    data.refresh_token,
  );
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await (supabaseAdmin as any)
    .from("tenant_docusign_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq("tenant_id", tenantId);
  return {
    accessToken: refreshed.access_token,
    accountId: data.account_id,
    baseUri: data.base_uri,
  };
}

export const disconnectDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_docusign_connections")
      .update({
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        account_id: null,
        account_name: null,
        base_uri: null,
        connect_secret: null,
        connect_configuration_id: null,
        connected_at: null,
      })
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
