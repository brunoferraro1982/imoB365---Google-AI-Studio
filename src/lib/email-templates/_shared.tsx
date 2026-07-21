import * as React from "react";
import { Body, Container, Head, Hr, Html, Section, Text } from "@react-email/components";

// Paleta e tom compartilhados por todos os e-mails transacionais da imoB365 —
// mesma cor de marca usada nos e-mails de trial/cron (ver
// src/routes/api.public.cron.expire-trials.ts) e nos botões primários do app
// (--primary em src/styles.css, aproximadamente #F2622C em hex).
export const brand = {
  orange: "#F2622C",
  orangeDark: "#D65E1B",
  dark: "#0F172A",
  text: "#3F3F46",
  muted: "#8A8A93",
  border: "#E5E5E5",
  bg: "#F5F5F4",
};

export const button = {
  backgroundColor: brand.orange,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "bold" as const,
  borderRadius: "10px",
  padding: "13px 28px",
  textDecoration: "none",
  display: "inline-block",
};

export const codeBox = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: "28px",
  fontWeight: "bold" as const,
  letterSpacing: "6px",
  color: brand.dark,
  backgroundColor: brand.bg,
  border: `1px solid ${brand.border}`,
  borderRadius: "10px",
  padding: "16px 24px",
  textAlign: "center" as const,
  margin: "0 0 28px",
};

const main = {
  backgroundColor: brand.bg,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "32px 0",
};

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  border: `1px solid ${brand.border}`,
  padding: "36px 40px 32px",
  maxWidth: "480px",
  margin: "0 auto",
};

const wordmark = {
  fontSize: "20px",
  fontWeight: "900" as const,
  letterSpacing: "-0.02em",
  margin: "0 0 28px",
};

const hr = { borderColor: brand.border, margin: "32px 0 20px" };

const footerText = {
  fontSize: "12px",
  color: brand.muted,
  lineHeight: "1.6",
  margin: "0 0 6px",
};

export function EmailShell({ children }: { children: React.ReactNode }) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={wordmark}>
            <span style={{ color: brand.dark }}>imo</span>
            <span style={{ color: brand.orange }}>B365</span>
          </Text>
          <Section>{children}</Section>
          <Hr style={hr} />
          <Text style={footerText}>
            Este é um e-mail automático da imoB365 — não é necessário responder.
          </Text>
          <Text style={footerText}>
            Dúvidas? Fale com a gente em{" "}
            <a href="mailto:contato@imob365.com.br" style={{ color: brand.muted }}>
              contato@imob365.com.br
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const h1 = {
  fontSize: "21px",
  fontWeight: "bold" as const,
  color: brand.dark,
  margin: "0 0 16px",
};

export const text = {
  fontSize: "14.5px",
  color: brand.text,
  lineHeight: "1.6",
  margin: "0 0 24px",
};

export const link = { color: brand.orange, textDecoration: "underline" };

export const footer = {
  fontSize: "12.5px",
  color: brand.muted,
  lineHeight: "1.5",
  margin: "24px 0 0",
};
