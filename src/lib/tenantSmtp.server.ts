import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Envio de e-mail pelo SMTP do PRÓPRIO tenant (canal "email" da Central de
 * Atendimento, `tenant_atendimento_canal_config`) — nunca por uma conta
 * compartilhada da plataforma (ver memória "imob365-tenant-autonomy-byo-
 * credentials"). Server-only: lê a senha SMTP via service_role.
 *
 * Best-effort: devolve `{enviado:false, motivo}` em vez de lançar, pra quem
 * chama decidir se a falha de e-mail deve ou não travar o fluxo principal.
 */

export type CanalEmailConfig = {
  smtp_host?: string;
  smtp_port?: number;
  usuario?: string;
  senha?: string;
  endereco_exibicao?: string;
};

export type EnvioEmailResultado = { enviado: true } | { enviado: false; motivo: string };

export async function getTenantSmtp(
  tenantId: string,
): Promise<{ ok: true; cfg: CanalEmailConfig } | { ok: false; motivo: string }> {
  const { data: canal } = await supabaseAdmin
    .from("tenant_atendimento_canal_config")
    .select("config,ativo")
    .eq("tenant_id", tenantId)
    .eq("canal", "email")
    .maybeSingle();
  if (!canal?.ativo) return { ok: false, motivo: "Canal de e-mail não configurado" };

  const cfg = canal.config as CanalEmailConfig;
  if (!cfg.smtp_host || !cfg.usuario || !cfg.senha) {
    return { ok: false, motivo: "Configuração de e-mail incompleta" };
  }
  return { ok: true, cfg };
}

export async function sendWithSmtp(
  cfg: CanalEmailConfig,
  mail: { to: string | string[]; subject: string; text: string; html?: string; replyTo?: string },
): Promise<EnvioEmailResultado> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: cfg.smtp_port ?? 587,
      secure: cfg.smtp_port === 465,
      auth: { user: cfg.usuario, pass: cfg.senha },
    });
    await transporter.sendMail({
      from: cfg.endereco_exibicao || cfg.usuario,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo,
    });
    return { enviado: true };
  } catch (err) {
    return { enviado: false, motivo: err instanceof Error ? err.message : "Falha ao enviar" };
  }
}

export async function sendTenantEmail(
  tenantId: string,
  mail: Parameters<typeof sendWithSmtp>[1],
): Promise<EnvioEmailResultado> {
  const smtp = await getTenantSmtp(tenantId);
  if (!smtp.ok) return { enviado: false, motivo: smtp.motivo };
  return sendWithSmtp(smtp.cfg, mail);
}
