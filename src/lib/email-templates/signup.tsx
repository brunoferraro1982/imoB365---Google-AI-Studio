import * as React from "react";
import { Button, Preview, Text } from "@react-email/components";
import { EmailShell, button, footer, h1, link, text } from "./_shared";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <EmailShell>
    <Preview>Confirme seu e-mail para ativar sua conta na imoB365</Preview>
    <Text style={h1}>Confirme seu e-mail</Text>
    <Text style={text}>
      Olá! Recebemos seu cadastro na <strong>imoB365</strong>, a plataforma que conecta
      imobiliárias, corretores e clientes. Para ativar sua conta (
      <a href={`mailto:${recipient}`} style={link}>
        {recipient}
      </a>
      ), confirme seu e-mail clicando no botão abaixo.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Confirmar e-mail
    </Button>
    <Text style={footer}>
      Se você não criou uma conta na imoB365, pode ignorar este e-mail com segurança.
    </Text>
  </EmailShell>
);

export default SignupEmail;
