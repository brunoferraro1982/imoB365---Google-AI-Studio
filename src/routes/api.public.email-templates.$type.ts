import * as React from "react";
import { render } from "@react-email/components";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { InviteEmail } from "@/lib/email-templates/invite";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

// Serve os templates de e-mail (mesmos componentes usados pelo webhook do
// Lovable, ver src/routes/lovable/email/auth/webhook.ts) como HTML estático
// com placeholders no formato Go template ({{ .ConfirmationURL }} etc.) — é
// o formato que o GoTrue espera em GOTRUE_MAILER_TEMPLATES_* (busca a URL via
// HTTP e faz sua própria substituição de variáveis). Isso dá pro GoTrue
// enviar os e-mails nativos (SMTP direto, sem fila) já com a marca imoB365,
// em vez do template padrão em inglês.
// Variáveis disponíveis em todo tipo: SiteURL, ConfirmationURL, Token,
// TokenHash, Email, Data. email_change ganha também NewEmail.
const TEMPLATES: Record<string, () => React.ReactElement> = {
  confirmation: () =>
    React.createElement(SignupEmail, {
      siteName: "imoB365",
      siteUrl: "{{ .SiteURL }}",
      recipient: "{{ .Email }}",
      confirmationUrl: "{{ .ConfirmationURL }}",
    }),
  recovery: () =>
    React.createElement(RecoveryEmail, {
      siteName: "imoB365",
      confirmationUrl: "{{ .ConfirmationURL }}",
    }),
  "magic-link": () =>
    React.createElement(MagicLinkEmail, {
      siteName: "imoB365",
      confirmationUrl: "{{ .ConfirmationURL }}",
    }),
  invite: () =>
    React.createElement(InviteEmail, {
      siteName: "imoB365",
      siteUrl: "{{ .SiteURL }}",
      confirmationUrl: "{{ .ConfirmationURL }}",
    }),
  "email-change": () =>
    React.createElement(EmailChangeEmail, {
      siteName: "imoB365",
      oldEmail: "{{ .Email }}",
      email: "{{ .Email }}",
      newEmail: "{{ .NewEmail }}",
      confirmationUrl: "{{ .ConfirmationURL }}",
    }),
  reauthentication: () => React.createElement(ReauthenticationEmail, { token: "{{ .Token }}" }),
};

export const Route = createFileRoute("/api/public/email-templates/$type")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const build = TEMPLATES[params.type];
        if (!build) {
          return new Response("Not found", { status: 404 });
        }
        const html = await render(build());
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
