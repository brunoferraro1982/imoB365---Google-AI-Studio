import * as React from "react";
import { Button, Preview, Text } from "@react-email/components";
import { EmailShell, button, footer, h1, link, text } from "./_shared";

interface EmailChangeEmailProps {
  siteName: string;
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailShell>
    <Preview>Confirme a troca de e-mail da sua conta imoB365</Preview>
    <Text style={h1}>Confirme seu novo e-mail</Text>
    <Text style={text}>
      Recebemos uma solicitação para alterar o e-mail da sua conta <strong>imoB365</strong> de{" "}
      <a href={`mailto:${oldEmail}`} style={link}>
        {oldEmail}
      </a>{" "}
      para{" "}
      <a href={`mailto:${newEmail}`} style={link}>
        {newEmail}
      </a>
      . Confirme essa alteração clicando no botão abaixo.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Confirmar novo e-mail
    </Button>
    <Text style={footer}>
      Se você não solicitou essa alteração, entre em contato com nosso suporte imediatamente.
    </Text>
  </EmailShell>
);

export default EmailChangeEmail;
