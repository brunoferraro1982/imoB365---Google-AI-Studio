import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyMercadoPagoOAuthState } from "@/lib/mercadopagoOAuth.functions";

// Callback do fluxo "Conectar Mercado Pago" (Fase 3 do módulo Financeiro —
// ver src/lib/mercadopagoOAuth.functions.ts). O Mercado Pago redireciona o
// navegador do admin do tenant pra cá com `code`+`state` depois que ele
// autoriza a conexão na tela do próprio Mercado Pago.
export const Route = createFileRoute("/api/public/mercadopago/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const appUrl = process.env.APP_URL ?? url.origin;
        const settingsUrl = `${appUrl}/app/configuracoes/integracoes-bancarias/mercadopago`;

        if (!code || !state) {
          return Response.redirect(`${settingsUrl}?mp_error=parametros_ausentes`, 302);
        }

        const verified = await verifyMercadoPagoOAuthState(state);
        if (!verified) {
          return Response.redirect(`${settingsUrl}?mp_error=state_invalido`, 302);
        }

        const clientId = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID;
        const clientSecret = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          console.error("[mercadopago-oauth-callback] client_id/secret não configurados");
          return Response.redirect(`${settingsUrl}?mp_error=integracao_nao_configurada`, 302);
        }

        try {
          const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              grant_type: "authorization_code",
              redirect_uri: `${process.env.APP_URL}/api/public/mercadopago/oauth/callback`,
            }),
          });
          const tokenBody = await tokenRes.json().catch(() => null);
          if (!tokenRes.ok || !tokenBody?.access_token) {
            console.error("[mercadopago-oauth-callback] falha ao trocar code por token", tokenBody);
            return Response.redirect(`${settingsUrl}?mp_error=token_exchange_falhou`, 302);
          }

          const expiresAt = new Date(Date.now() + Number(tokenBody.expires_in ?? 0) * 1000);

          const { error } = await (supabaseAdmin as any).from("tenant_mercadopago_accounts").upsert(
            {
              tenant_id: verified.tenantId,
              mp_user_id: tokenBody.user_id,
              access_token: tokenBody.access_token,
              refresh_token: tokenBody.refresh_token,
              public_key: tokenBody.public_key ?? null,
              scope: tokenBody.scope ?? null,
              live_mode: tokenBody.live_mode ?? true,
              expires_at: expiresAt.toISOString(),
              connected_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id" },
          );
          if (error) {
            console.error("[mercadopago-oauth-callback] falha ao salvar conexão", error);
            return Response.redirect(`${settingsUrl}?mp_error=erro_ao_salvar`, 302);
          }

          return Response.redirect(`${settingsUrl}?mp_connected=1`, 302);
        } catch (err) {
          console.error("[mercadopago-oauth-callback] erro inesperado", err);
          return Response.redirect(`${settingsUrl}?mp_error=erro_inesperado`, 302);
        }
      },
    },
  },
});
