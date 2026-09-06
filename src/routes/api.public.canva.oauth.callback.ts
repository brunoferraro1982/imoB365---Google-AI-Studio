import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCanvaOAuthState, trocarCodePorToken } from "@/lib/canvaOAuth.functions";

// Callback do fluxo "Conectar Canva" (ver src/lib/canvaOAuth.functions.ts).
// A Canva redireciona o navegador do admin do tenant pra cá com
// `code`+`state` depois que ele autoriza a conexão na tela de
// consentimento da própria Canva. Diferente do callback da Meta: o
// code_verifier (PKCE) vem embutido no `state` assinado, não em nenhum
// cookie/sessão — mesma técnica documentada em canvaOAuth.functions.ts.
export const Route = createFileRoute("/api/public/canva/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const appUrl = process.env.APP_URL ?? url.origin;
        const settingsUrl = `${appUrl}/app/portais/canva`;

        if (!code || !state) {
          return Response.redirect(`${settingsUrl}?canva_error=parametros_ausentes`, 302);
        }

        const verified = await verifyCanvaOAuthState(state);
        if (!verified) {
          return Response.redirect(`${settingsUrl}?canva_error=state_invalido`, 302);
        }

        const { data: conexao } = await (supabaseAdmin as any)
          .from("tenant_canva_connections")
          .select("client_id,client_secret")
          .eq("tenant_id", verified.tenantId)
          .maybeSingle();
        const clientId = conexao?.client_id;
        const clientSecret = conexao?.client_secret;
        if (!clientId || !clientSecret) {
          console.error("[canva-oauth-callback] tenant sem App configurado", verified.tenantId);
          return Response.redirect(`${settingsUrl}?canva_error=integracao_nao_configurada`, 302);
        }

        try {
          const redirectUri = `${appUrl}/api/public/canva/oauth/callback`;
          const token = await trocarCodePorToken(
            clientId,
            clientSecret,
            code,
            verified.codeVerifier,
            redirectUri,
          );

          const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

          const { error } = await (supabaseAdmin as any)
            .from("tenant_canva_connections")
            .update({
              access_token: token.access_token,
              refresh_token: token.refresh_token,
              token_expires_at: expiresAt,
              connected_at: new Date().toISOString(),
            })
            .eq("tenant_id", verified.tenantId);
          if (error) {
            console.error("[canva-oauth-callback] falha ao salvar conexão", error);
            return Response.redirect(`${settingsUrl}?canva_error=erro_ao_salvar`, 302);
          }

          return Response.redirect(`${settingsUrl}?canva_connected=1`, 302);
        } catch (err) {
          console.error("[canva-oauth-callback] erro ao trocar code por token", err);
          return Response.redirect(`${settingsUrl}?canva_error=token_exchange_falhou`, 302);
        }
      },
    },
  },
});
