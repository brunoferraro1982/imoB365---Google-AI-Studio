import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Conexão OAuth por tenant com a Meta (Facebook/Instagram) — CADA TENANT
// TEM O PRÓPRIO META APP (App ID + App Secret, criado pelo próprio tenant
// no Business Manager dele, colado na tela app.portais.meta.tsx), não um
// app único compartilhado pelo imoB365. Motivo: leads_retrieval/
// catalog_management só funcionam em "Standard Access" pra Páginas que o
// próprio app já possui — um app único gerenciando Páginas de terceiros
// exigiria App Review + Business Verification da Meta (semanas, sem
// garantia), inviável de operar centralizado. Usado pra alimentar o
// catálogo de produtos (ver api.public.feeds.$tenantSlug.meta-catalog.csv.ts)
// e receber de volta os leads de campanhas via Lead Ads webhook — ver
// supabase/migrations/20260805190000_tenant_meta_connections_byo_app.sql.
//
// Espelha mercadopagoOAuth.functions.ts na técnica (state assinado via
// HMAC), mas diverge no split app/conexão: lá o app é único da plataforma,
// aqui o app também é por tenant (mesmo princípio BYO já usado em
// atendimentoEmail.functions.ts/atendimentoWhatsApp.functions.ts).

const STATE_TTL_MS = 10 * 60 * 1000;
const META_GRAPH_VERSION = "v21.0";

// Valor único e fixo (não é segredo por-tenant, não precisa vir de env var)
// que instruímos todo tenant a colar no campo "Token de verificação" do
// próprio Webhook dele — só prova que quem configurou pegou o valor das
// instruções do imoB365. A segurança de verdade é a assinatura HMAC do POST
// (ver api.public.webhooks.meta.ts), essa sim por-tenant.
export const META_WEBHOOK_VERIFY_TOKEN = "imob365-meta-webhook";

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
  appConfigured: boolean;
  connected: boolean;
  pageName: string | null;
  connectedAt: string | null;
  instagramConnected: boolean;
  loginConfigId: string | null;
};

export const getMetaConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaConnectionStatus> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);

    const { data } = await (supabaseAdmin as any)
      .from("tenant_meta_connections")
      .select(
        "app_id,app_secret,page_name,connected_at,instagram_business_account_id,login_config_id",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    return {
      appConfigured: !!data?.app_id && !!data?.app_secret,
      connected: !!data?.page_name,
      pageName: data?.page_name ?? null,
      connectedAt: data?.connected_at ?? null,
      instagramConnected: !!data?.instagram_business_account_id,
      loginConfigId: data?.login_config_id ?? null,
    };
  });

const salvarMetaAppCredentialsSchema = z.object({
  appId: z.string().trim().min(5, "ID do aplicativo inválido").max(40),
  appSecret: z.string().trim().min(10, "Chave secreta do aplicativo inválida").max(80),
});

// Passo 1 do wizard (app.portais.meta.tsx): o tenant cola o App ID + App
// Secret do PRÓPRIO Meta App (criado no próprio Business Manager dele) —
// ainda não conecta nenhuma Página, só registra as credenciais que o
// getMetaAuthorizeUrl abaixo vai usar.
export const salvarMetaAppCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => salvarMetaAppCredentialsSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_meta_connections")
      .upsert(
        { tenant_id: tenantId, app_id: data.appId, app_secret: data.appSecret },
        { onConflict: "tenant_id" },
      );
    if (error) throw new Error(error.message);

    return { ok: true };
  });

const salvarLoginConfigIdSchema = z.object({
  loginConfigId: z.string().trim().min(5, "ID de configuração inválido").max(40),
});

// Separado de salvarMetaAppCredentials porque, na prática, o tenant só
// descobre que precisa disso DEPOIS de já ter salvo App ID/Secret e
// tentado conectar — achado real em produção (2026-09-04): apps tipo
// "Negócios" com "Login do Facebook para Empresas" só concedem acesso a
// Páginas de um Portfólio Empresarial através de uma Configuração de
// Login (config_id); o fluxo clássico por `scope` sempre retorna
// /me/accounts vazio nesse caso, mesmo com a Página corretamente
// atribuída. Ver getMetaAuthorizeUrl abaixo.
export const salvarMetaLoginConfigId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => salvarLoginConfigIdSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_meta_connections")
      .update({ login_config_id: data.loginConfigId })
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// Reinício completo — apaga app_id/app_secret junto com qualquer conexão de
// Página existente. Diferente de disconnectMeta (que só desconecta a
// Página, preservando o App já configurado).
export const removerMetaAppCredentials = createServerFn({ method: "POST" })
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

export const getMetaAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL não configurada");

    const { data: conexao } = await (supabaseAdmin as any)
      .from("tenant_meta_connections")
      .select("app_id,login_config_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!conexao?.app_id) {
      throw new Error("Configure seu App da Meta (App ID/App Secret) antes de conectar a Página");
    }

    const redirectUri = `${appUrl}/api/public/meta/oauth/callback`;
    const state = await signState(tenantId);
    const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", conexao.app_id);
    url.searchParams.set("redirect_uri", redirectUri);
    // Explícito por clareza — já era o comportamento padrão da Meta quando
    // este parâmetro é omitido (confirmado na doc oficial:
    // developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow),
    // e é exatamente o que o callback (api.public.meta.oauth.callback.ts)
    // já espera: um `code` pra trocar por access_token no servidor com o
    // App Secret. O requisito de passar "response_type: 'code'" que a Meta
    // documenta para fluxos com config_id é específico do SDK JavaScript
    // (FB.login(), popup client-side, cujo padrão implícito é "token") —
    // não deste redirecionamento direto pro dialog/oauth, que sempre foi
    // server-side por padrão.
    url.searchParams.set("response_type", "code");

    if (conexao.login_config_id) {
      // Achado real em produção (2026-09-04): apps tipo "Negócios" com o
      // produto "Login do Facebook para Empresas" só concedem acesso a
      // Páginas de um Portfólio Empresarial através de uma Configuração
      // de Login — o fluxo clássico por `scope` sempre volta com
      // /me/accounts = [] nesse caso, mesmo com a Página corretamente
      // atribuída e com acesso total (confirmado via log de produção).
      // Quando o tenant configurou uma Configuração de Login (passo 3.2
      // do wizard) e colou o ID aqui, usamos `config_id` — a própria
      // Configuração já define os ativos/permissões pedidos, então
      // `scope` não deve ser enviado junto (comportamento documentado
      // pela Meta pra esse parâmetro).
      url.searchParams.set("config_id", conexao.login_config_id);
    } else {
      url.searchParams.set(
        "scope",
        // pages_manage_posts/pages_read_engagement/instagram_basic/
        // instagram_content_publish são os escopos novos, pra publicar
        // Post/Story real (ver metaPublish.functions.ts) — mesmo regime de
        // Standard Access já usado pros escopos originais (BYO: o próprio
        // tenant tem papel no próprio app). O nome correto aqui é
        // "instagram_content_publish" (produto Instagram Graph API via
        // Facebook Login, o mesmo diálogo facebook.com/.../dialog/oauth já
        // usado por todo o resto deste fluxo) — "instagram_business_*" é o
        // nome de escopo de um produto DIFERENTE (Instagram API with
        // Instagram Login, autorizado em instagram.com/oauth/authorize, com
        // token/endpoints de publicação próprios). Usar o nome errado nesse
        // diálogo fazia a Meta rejeitar com "Invalid Scopes:
        // instagram_business_content_publish" — achado real testando em
        // produção (bruno.ferraro09@hotmail.com, 2026-09-04). Esse caminho
        // (sem config_id) só funciona pra Páginas que NÃO pertencem a um
        // Portfólio Empresarial.
        "pages_show_list,pages_manage_metadata,leads_retrieval,catalog_management,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish",
      );
    }
    url.searchParams.set("state", state);

    return { url: url.toString() };
  });

// Desconecta só a Página (volta pro estado "App configurado, sem Página
// conectada") — preserva app_id/app_secret pra não obrigar o tenant a
// redigitar tudo só pra reconectar.
export const disconnectMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantId(supabase, userId);
    await requireTenantAdmin(supabase, userId, tenantId);

    const { error } = await (supabaseAdmin as any)
      .from("tenant_meta_connections")
      .update({
        meta_user_id: null,
        page_id: null,
        page_name: null,
        page_access_token: null,
        instagram_business_account_id: null,
      })
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
