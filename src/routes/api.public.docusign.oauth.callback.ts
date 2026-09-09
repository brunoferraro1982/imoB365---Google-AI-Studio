import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  verifyDocusignOAuthState,
  trocarCodePorToken,
  buscarUserInfo,
  type DocusignAccount,
} from "@/lib/docusignOAuth.functions";

// Callback OAuth do DocuSign — mesmo padrão de api.public.meta.oauth.callback.ts
// e api.public.canva.oauth.callback.ts: troca code por token, descobre a
// conta (account_id/base_uri via /oauth/userinfo, únicos do DocuSign — a
// mesma Integration Key pode "ver" várias contas se o usuário logado
// pertencer a mais de uma, escolhemos a marcada is_default), salva e
// configura automaticamente o DocuSign Connect (webhook nativo do
// DocuSign) pra esse tenant já sair funcionando sem passo manual extra no
// painel deles — só assim o "assinado" chega de volta pro imob365 sem a
// pessoa precisar ir configurar isso na mão.
export const Route = createFileRoute("/api/public/docusign/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const appUrl = process.env.APP_URL ?? url.origin;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const redirect = (path: string) => Response.redirect(`${appUrl}${path}`, 302);

        if (!code || !state) {
          return redirect(
            "/app/configuracoes/assinatura-eletronica?docusign_error=parametros_ausentes",
          );
        }

        const payload = await verifyDocusignOAuthState(state);
        if (!payload) {
          return redirect("/app/configuracoes/assinatura-eletronica?docusign_error=state_invalido");
        }
        const { tenantId } = payload;

        const { data: conexao } = await (supabaseAdmin as any)
          .from("tenant_docusign_connections")
          .select("client_id,client_secret")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (!conexao?.client_id || !conexao?.client_secret) {
          return redirect(
            "/app/configuracoes/assinatura-eletronica?docusign_error=integracao_nao_configurada",
          );
        }

        let token;
        try {
          token = await trocarCodePorToken(conexao.client_id, conexao.client_secret, code);
        } catch (err) {
          console.error("Falha na troca de code por token (DocuSign)", err);
          return redirect(
            "/app/configuracoes/assinatura-eletronica?docusign_error=token_exchange_falhou",
          );
        }

        let userInfo;
        try {
          userInfo = await buscarUserInfo(token.access_token);
        } catch (err) {
          console.error("Falha ao buscar userinfo (DocuSign)", err);
          return redirect(
            "/app/configuracoes/assinatura-eletronica?docusign_error=userinfo_falhou",
          );
        }
        const conta: DocusignAccount =
          userInfo.accounts.find((a) => a.is_default === "true" || a.is_default === true) ??
          userInfo.accounts[0];

        const tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

        // Connect (webhook nativo do DocuSign) configurado automaticamente —
        // best-effort: se falhar, a conexão principal ainda funciona (dá pra
        // enviar envelope), só a confirmação automática de "assinado" que
        // fica pendente até reconfigurar. Nunca deve travar o fluxo de
        // conexão principal.
        let connectSecret: string | null = null;
        let connectConfigurationId: string | null = null;
        try {
          const restBase = `${conta.base_uri}/restapi/v2.1/accounts/${conta.account_id}`;
          const secretRes = await fetch(`${restBase}/connect/secret`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
            },
          });
          const secretJson = await secretRes.json().catch(() => null);
          connectSecret = secretJson?.connectSecret ?? null;

          const webhookUrl = `${appUrl}/api/public/webhooks/docusign?tenant_id=${tenantId}`;
          const configRes = await fetch(`${restBase}/connect`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "imob365",
              urlToPublishTo: webhookUrl,
              allowEnvelopePublish: "true",
              includeHMAC: connectSecret ? "true" : "false",
              envelopeEvents: "sent,delivered,completed,declined,voided",
              eventData: { format: "json", version: "restv2.1" },
            }),
          });
          const configJson = await configRes.json().catch(() => null);
          connectConfigurationId = configJson?.connectId ?? null;
        } catch (err) {
          console.error("Falha ao configurar DocuSign Connect (best-effort, não bloqueia)", err);
        }

        const { error } = await (supabaseAdmin as any)
          .from("tenant_docusign_connections")
          .update({
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            token_expires_at: tokenExpiresAt,
            account_id: conta.account_id,
            account_name: conta.account_name,
            base_uri: conta.base_uri,
            connect_secret: connectSecret,
            connect_configuration_id: connectConfigurationId,
            connected_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenantId);
        if (error) {
          console.error("Erro ao salvar conexão DocuSign", error);
          return redirect("/app/configuracoes/assinatura-eletronica?docusign_error=erro_ao_salvar");
        }

        return redirect("/app/configuracoes/assinatura-eletronica?docusign_connected=1");
      },
    },
  },
});
