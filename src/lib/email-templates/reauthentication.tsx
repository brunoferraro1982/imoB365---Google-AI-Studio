import * as React from "react";
import { Preview, Text } from "@react-email/components";
import { EmailShell, codeBox, footer, h1, text } from "./_shared";

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailShell>
    <Preview>Seu código de verificação imoB365</Preview>
    <Text style={h1}>Confirme sua identidade</Text>
    <Text style={text}>Use o código abaixo para confirmar sua identidade na imoB365:</Text>
    <Text style={codeBox}>{token}</Text>
    <Text style={footer}>
      Este código expira em breve. Se você não solicitou essa verificação, pode ignorar este e-mail
      com segurança.
    </Text>
  </EmailShell>
);

export default ReauthenticationEmail;
