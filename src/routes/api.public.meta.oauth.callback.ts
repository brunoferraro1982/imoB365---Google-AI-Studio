import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyMetaOAuthState } from "@/lib/metaOAuth.functions";

const META_GRAPH_VERSION = "v21.0";

// Callback do fluxo "Conectar Facebook/Instagram" (ver
// src/lib/metaOAuth.functions.ts). A Meta redireciona o navegador do admin
// do tenant pra cá com `code`+`state` depois que ele autoriza a conexão na
// tela de consentimento da própria Meta.
export const Route = createFileRoute("/api/public/meta/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const appUrl = process.env.APP_URL ?? url.origin;
        const settingsUrl = `${appUrl}/app/portais/meta`;

        if (!code || !state) {
          return Response.redirect(`${settingsUrl}?meta_error=parametros_ausentes`, 302);
        }

        const verified = await verifyMetaOAuthState(state);
        if (!verified) {
          return Response.redirect(`${settingsUrl}?meta_error=state_invalido`, 302);
        }

        // App por tenant (não mais um app único da plataforma) — busca as
        // credenciais que o próprio tenant colou no Passo 1 do wizard
        // (ver app.portais.meta.tsx / salvarMetaAppCredentials).
        const { data: conexao } = await (supabaseAdmin as any)
          .from("tenant_meta_connections")
          .select("app_id,app_secret")
          .eq("tenant_id", verified.tenantId)
          .maybeSingle();
        const clientId = conexao?.app_id;
        const clientSecret = conexao?.app_secret;
        if (!clientId || !clientSecret) {
          console.error("[meta-oauth-callback] tenant sem App configurado", verified.tenantId);
          return Response.redirect(`${settingsUrl}?meta_error=integracao_nao_configurada`, 302);
        }

        try {
          const redirectUri = `${appUrl}/api/public/meta/oauth/callback`;

          // 1) code -> token de usuário de curta duração
          const shortTokenUrl = new URL(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
          );
          shortTokenUrl.searchParams.set("client_id", clientId);
          shortTokenUrl.searchParams.set("client_secret", clientSecret);
          shortTokenUrl.searchParams.set("redirect_uri", redirectUri);
          shortTokenUrl.searchParams.set("code", code);
          const shortRes = await fetch(shortTokenUrl.toString());
          const shortBody = await shortRes.json().catch(() => null);
          if (!shortRes.ok || !shortBody?.access_token) {
            console.error("[meta-oauth-callback] falha ao trocar code por token", shortBody);
            return Response.redirect(`${settingsUrl}?meta_error=token_exchange_falhou`, 302);
          }

          // 2) token de usuário de curta -> longa duração
          const longTokenUrl = new URL(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
          );
          longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
          longTokenUrl.searchParams.set("client_id", clientId);
          longTokenUrl.searchParams.set("client_secret", clientSecret);
          longTokenUrl.searchParams.set("fb_exchange_token", shortBody.access_token);
          const longRes = await fetch(longTokenUrl.toString());
          const longBody = await longRes.json().catch(() => null);
          const userToken = longBody?.access_token ?? shortBody.access_token;

          // 3) Páginas que o usuário administra — v1 seleciona a primeira
          // automaticamente (trocar de página fica pra uma melhoria futura,
          // não bloqueia o v1).
          const pagesRes = await fetch(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?access_token=${encodeURIComponent(userToken)}`,
          );
          const pagesBody = await pagesRes.json().catch(() => null);
          const page = pagesBody?.data?.[0];
          if (!pagesRes.ok || !page) {
            console.error("[meta-oauth-callback] nenhuma página encontrada", pagesBody);
            return Response.redirect(`${settingsUrl}?meta_error=nenhuma_pagina`, 302);
          }

          // 4) me -> id do usuário Meta
          const meRes = await fetch(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/me?access_token=${encodeURIComponent(userToken)}`,
          );
          const meBody = await meRes.json().catch(() => null);

          const { error } = await (supabaseAdmin as any).from("tenant_meta_connections").upsert(
            {
              tenant_id: verified.tenantId,
              meta_user_id: meBody?.id ?? "",
              page_id: page.id,
              page_name: page.name ?? null,
              page_access_token: page.access_token,
              connected_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id" },
          );
          if (error) {
            console.error("[meta-oauth-callback] falha ao salvar conexão", error);
            return Response.redirect(`${settingsUrl}?meta_error=erro_ao_salvar`, 302);
          }

          // Inscreve a Página pro evento de Lead Ads — só tem efeito prático
          // quando a Fase 3 (webhook) estiver no ar, mas já habilita aqui
          // pra não exigir reconectar depois.
          try {
            await fetch(
              `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}/subscribed_apps?subscribed_fields=leadgen&access_token=${encodeURIComponent(page.access_token)}`,
              { method: "POST" },
            );
          } catch (subErr) {
            console.error(
              "[meta-oauth-callback] falha ao inscrever leadgen (não bloqueante)",
              subErr,
            );
          }

          return Response.redirect(`${settingsUrl}?meta_connected=1`, 302);
        } catch (err) {
          console.error("[meta-oauth-callback] erro inesperado", err);
          return Response.redirect(`${settingsUrl}?meta_error=erro_inesperado`, 302);
        }
      },
    },
  },
});
