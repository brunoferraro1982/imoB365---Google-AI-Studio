import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Conexão OAuth com o Google Ads — DIFERENTE de todas as outras
// integrações BYO deste projeto (Meta/Canva/DocuSign/Focus NFe): não é
// por tenant. Achado de arquitetura confirmado contra a documentação
// oficial do Google Ads API: o Developer Token (obrigatório em toda
// chamada) é emitido uma vez POR EMPRESA, não por cliente final — não
// existe um caminho de "cada corretor cria a própria integração
// instantânea" como nos outros provedores. Decisão de negócio do usuário:
// só o super_admin conecta a ÚNICA conta Google Ads da própria imoB365
// (o cartão que paga o gasto real é dela); imobiliária/corretor nunca
// conecta conta própria aqui — só monta/paga campanha e acompanha
// performance (ver googleAdsCampanhas.functions.ts).
//
// client_id/client_secret/developer_token vêm de variável de ambiente da
// PLATAFORMA (GOOGLE_ADS_CLIENT_ID/SECRET/DEVELOPER_TOKEN), não de uma
// tabela por tenant — o usuário precisa criar o projeto no Google Cloud +
// solicitar o Developer Token no Google Ads API Center uma única vez.

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

async function requireSuperAdmin(supabase: any, userId: string) {
  const { data: isSuper } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!isSuper) {
    throw new Error("Apenas o super_admin da imoB365 pode gerenciar a conexão com o Google Ads");
  }
}

export type GoogleAdsConnectionStatus = {
  appConfigured: boolean;
  connected: boolean;
  connectedAt: string | null;
  customerId: string | null;
};

export const getGoogleAdsConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<GoogleAdsConnectionStatus> => {
    const appConfigured = !!(
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    );

    const { data } = await (supabaseAdmin as any)
      .from("google_ads_config")
      .select("access_token,connected_at,customer_id")
      .eq("singleton", true)
      .maybeSingle();

    return {
      appConfigured,
      connected: !!data?.access_token,
      connectedAt: data?.connected_at ?? null,
      customerId: data?.customer_id ?? null,
    };
  });

export const getGoogleAdsAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { supabase, userId } = context;
    await requireSuperAdmin(supabase, userId);

    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const appUrl = process.env.APP_URL;
    if (!clientId) throw new Error("GOOGLE_ADS_CLIENT_ID não configurada no servidor");
    if (!appUrl) throw new Error("APP_URL não configurada");

    const redirectUri = `${appUrl}/api/public/googleads/oauth/callback`;
    const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_ADS_SCOPE);
    // access_type=offline + prompt=consent: sem isso o Google só devolve
    // refresh_token na primeiríssima autorização de cada usuário+client_id
    // — como o super_admin pode desconectar/reconectar, forçamos sempre.
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    return { url: url.toString() };
  });

type GoogleToken = { access_token: string; refresh_token?: string; expires_in: number };

export async function trocarCodePorToken(code: string): Promise<GoogleToken> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error("Integração com Google Ads não configurada no servidor");
  }
  const redirectUri = `${appUrl}/api/public/googleads/oauth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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

async function refreshAccessToken(refreshToken: string): Promise<GoogleToken> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Integração com Google Ads não configurada");

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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

// Usado por googleAdsCampanhas.functions.ts antes de qualquer chamada à
// API do Google Ads. O Google não reemite refresh_token a cada renovação
// (diferente da Canva) — persistimos só o access_token/expiração novos.
export async function getValidGoogleAdsAccessToken(): Promise<{
  accessToken: string;
  customerId: string;
}> {
  const { data } = await (supabaseAdmin as any)
    .from("google_ads_config")
    .select("access_token,refresh_token,token_expires_at,customer_id")
    .eq("singleton", true)
    .maybeSingle();
  if (!data?.access_token || !data?.refresh_token || !data?.customer_id) {
    throw new Error(
      "Conecte a conta Google Ads da imoB365 antes de continuar (Admin → Google Ads).",
    );
  }
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (Date.now() < expiresAt - 60_000) {
    return { accessToken: data.access_token, customerId: data.customer_id };
  }

  const refreshed = await refreshAccessToken(data.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await (supabaseAdmin as any)
    .from("google_ads_config")
    .update({ access_token: refreshed.access_token, token_expires_at: newExpiresAt })
    .eq("singleton", true);
  return { accessToken: refreshed.access_token, customerId: data.customer_id };
}

export const disconnectGoogleAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await requireSuperAdmin(supabase, userId);

    const { error } = await (supabaseAdmin as any)
      .from("google_ads_config")
      .delete()
      .eq("singleton", true);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
