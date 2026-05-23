import * as React from "react";
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from "@react-email/components";

export interface NovoLeadEmailProps {
  corretorNome: string;
  tenantNome: string;
  leadNome: string;
  leadEmail?: string | null;
  leadTelefone?: string | null;
  leadMensagem?: string | null;
  link?: string;
}

export const NovoLeadEmail = ({
  corretorNome, tenantNome, leadNome,
  leadEmail, leadTelefone, leadMensagem, link,
}: NovoLeadEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo lead: {leadNome}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Olá, {corretorNome}!</Heading>
        <Text style={text}>Você recebeu um novo lead em <strong>{tenantNome}</strong>.</Text>
        <Section style={card}>
          <Text style={row}><strong>Nome:</strong> {leadNome}</Text>
          <Text style={row}><strong>E-mail:</strong> {leadEmail ?? "—"}</Text>
          <Text style={row}><strong>Telefone:</strong> {leadTelefone ?? "—"}</Text>
          {leadMensagem && <Text style={row}><strong>Mensagem:</strong><br />{leadMensagem}</Text>}
        </Section>
        {link && <Text style={text}><a href={link} style={btn}>Abrir lead</a></Text>}
        <Text style={footer}>imob365</Text>
      </Container>
    </Body>
  </Html>
);

export default NovoLeadEmail;

const main = { backgroundColor: "#f6f7f9", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px", maxWidth: "560px", margin: "0 auto" };
const h1 = { fontSize: "22px", fontWeight: "bold" as const, color: "#0d0d0d", margin: "0 0 12px" };
const text = { fontSize: "14px", color: "#555", lineHeight: "1.5", margin: "0 0 16px" };
const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", margin: "12px 0" };
const row = { fontSize: "14px", color: "#1a1a1a", margin: "0 0 6px" };
const btn = { background: "#0d0d0d", color: "#fff", padding: "10px 16px", borderRadius: "8px", textDecoration: "none", display: "inline-block" };
const footer = { fontSize: "12px", color: "#999", margin: "32px 0 0" };