import * as React from "react";
import { Button, Preview, Text } from "@react-email/components";
import { EmailShell, button, footer, h1, text } from "./_shared";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <EmailShell>
    <Preview>Redefina sua senha na imoB365</Preview>
    <Text style={h1}>Redefinir sua senha</Text>
    <Text style={text}>
      Recebemos uma solicitação para redefinir a senha da sua conta na <strong>imoB365</strong>.
      Clique no botão abaixo para escolher uma nova senha. Por segurança, este link expira em breve.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Redefinir senha
    </Button>
    <Text style={footer}>
      Se você não solicitou a redefinição de senha, ignore este e-mail — sua senha atual continua
      válida.
    </Text>
  </EmailShell>
);

export default RecoveryEmail;
