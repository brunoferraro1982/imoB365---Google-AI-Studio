import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { trocarCodePorToken } from "@/lib/googleAdsOAuth.functions";

// Callback OAuth do Google Ads — conexão única da plataforma (não por
// tenant, ver googleAdsOAuth.functions.ts). Depois de trocar o code por
// token, descobre automaticamente a conta Google Ads acessível
// (GET /v25/customers:listAccessibleCustomers) em vez de pedir pro
// super_admin digitar o ID manualmente — evita erro de digitação.
export const Route = createFileRoute("/api/public/googleads/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const appUrl = process.env.APP_URL ?? url.origin;
        const settingsUrl = `${appUrl}/admin/google-ads`;
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          return Response.redirect(
            `${settingsUrl}?googleads_error=${encodeURIComponent(error)}`,
            302,
          );
        }
        if (!code) {
          return Response.redirect(`${settingsUrl}?googleads_error=parametros_ausentes`, 302);
        }

        let token;
        try {
          token = await trocarCodePorToken(code);
        } catch (err) {
          console.error("[googleads-oauth-callback] falha ao trocar code por token", err);
          return Response.redirect(`${settingsUrl}?googleads_error=token_exchange_falhou`, 302);
        }
        if (!token.refresh_token) {
          // Acontece se o usuário já tinha autorizado antes sem
          // access_type=offline+prompt=consent — pedimos pra desconectar
          // no Google (myaccount.google.com/permissions) e tentar de novo.
          return Response.redirect(`${settingsUrl}?googleads_error=sem_refresh_token`, 302);
        }

        let customerId: string | null = null;
        try {
          const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
          const res = await fetch(
            "https://googleads.googleapis.com/v25/customers:listAccessibleCustomers",
            {
              headers: {
                Authorization: `Bearer ${token.access_token}`,
                "developer-token": developerToken ?? "",
              },
            },
          );
          const json = await res.json().catch(() => null);
          const first: string | undefined = json?.resourceNames?.[0];
          customerId = first ? first.replace("customers/", "") : null;
        } catch (err) {
          console.error("[googleads-oauth-callback] falha ao listar contas acessíveis", err);
        }

        const tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

        const { error: dbError } = await (supabaseAdmin as any).from("google_ads_config").upsert(
          {
            singleton: true,
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            token_expires_at: tokenExpiresAt,
            customer_id: customerId,
            connected_at: new Date().toISOString(),
          },
          { onConflict: "singleton" },
        );
        if (dbError) {
          console.error("[googleads-oauth-callback] erro ao salvar conexão", dbError);
          return Response.redirect(`${settingsUrl}?googleads_error=erro_ao_salvar`, 302);
        }

        return Response.redirect(`${settingsUrl}?googleads_connected=1`, 302);
      },
    },
  },
});
