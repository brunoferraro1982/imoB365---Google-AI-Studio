import * as React from "react";
import { Button, Preview, Text } from "@react-email/components";
import { EmailShell, button, footer, h1, text } from "./_shared";

interface MagicLinkEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <EmailShell>
    <Preview>Seu link de acesso à imoB365</Preview>
    <Text style={h1}>Seu link de acesso</Text>
    <Text style={text}>
      Clique no botão abaixo para entrar na sua conta <strong>imoB365</strong> sem precisar digitar
      senha. Este link expira em breve, por segurança.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Entrar na minha conta
    </Button>
    <Text style={footer}>Se você não solicitou este acesso, pode ignorar este e-mail.</Text>
  </EmailShell>
);

export default MagicLinkEmail;
