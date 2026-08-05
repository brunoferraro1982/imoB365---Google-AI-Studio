import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Conexão OAuth por tenant com a Meta (Facebook/Instagram) — cada tenant
// conecta a PRÓPRIA conta Meta via OAuth, contra um único Meta App
// registrado uma vez pelo imoB365 (META_APP_ID/META_APP_SECRET). Usado pra
// alimentar o catálogo de produtos (Dynamic Ads/Marketplace, ver
// api.public.feeds.$tenantSlug.meta-catalog.csv.ts) e, numa fase seguinte,
// receber de volta os leads de campanhas via Lead Ads webhook — ver
// supabase/migrations/20260805171000_tenant_meta_connections.sql.
//
// Espelha mercadopagoOAuth.functions.ts propositalmente (mesma técnica de
// state assinado, mesmo split app-único/conexão-por-tenant).

const STATE_TTL_MS = 10 * 60 * 1000;
const META_GRAPH_VERSION = "v21.0";

// HMAC via Web Crypto (crypto.subtle) em vez de node:crypto — este arquivo é
// um *.functions.ts, bundlado pro client também; node:crypto não existe no
// browser e quebraria esse bundle.
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

async function signState(tenantId: string): Promise<string> {
  const payloadB64 = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ tenantId, ts: Date.now() })),
  );
  const key = await getHmacKey();
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64urlEncode(new Uint8Array(sigBuffer))}`;
}

export async function verifyMetaOAuthState(state: string): Promise<{ tenantId: string } | null> {
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
    throw new Error("Apenas administradores da imobiliária podem gerenciar a conexão com a Meta");
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

export type MetaConnectionStatus = {
  connected: boolean;
  pageName: string | null;
  connectedAt: string | null;
};

export const getMetaConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaConnectionStatus> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

    const { data } = await (supabaseAdmin as any)
      .from("tenant_meta_connections")
      .select("page_name,connected_at")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    return {
      connected: !!data,
      pageName: data?.page_name ?? null,
      connectedAt: data?.connected_at ?? null,
    };
  });

export const getMetaAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const clientId = process.env.META_APP_ID;
    const appUrl = process.env.APP_URL;
    if (!clientId || !appUrl) {
      throw new Error("Integração com a Meta não configurada (META_APP_ID/APP_URL ausentes)");
    }

    const redirectUri = `${appUrl}/api/public/meta/oauth/callback`;
    const state = await signState(tenantId);
    const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set(
      "scope",
      "pages_show_list,pages_manage_metadata,leads_retrieval,catalog_management",
    );
    url.searchParams.set("state", state);

    return { url: url.toString() };
  });

export const disconnectMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_meta_connections")
      .delete()
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
