import * as React from "react";
import { Button, Preview, Text } from "@react-email/components";
import { EmailShell, button, footer, h1, text } from "./_shared";

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <EmailShell>
    <Preview>Você foi convidado para a imoB365</Preview>
    <Text style={h1}>Você foi convidado</Text>
    <Text style={text}>
      Você foi convidado para fazer parte da <strong>imoB365</strong>, a plataforma que conecta
      imobiliárias, corretores e clientes. Clique no botão abaixo para aceitar o convite e criar sua
      conta.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Aceitar convite
    </Button>
    <Text style={footer}>Se você não esperava este convite, pode ignorá-lo com segurança.</Text>
  </EmailShell>
);

export default InviteEmail;
