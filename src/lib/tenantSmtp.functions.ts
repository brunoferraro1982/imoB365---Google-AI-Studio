import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import nodemailer from "nodemailer";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Configuração de e-mail (SMTP) POR TENANT — tela "Integrações > E-mail".
 *
 * Persistência: mesma linha de `tenant_atendimento_canal_config` (canal
 * "email") que já é lida por `tenantSmtp.server.ts` e pela Central de
 * Atendimento — nada de tabela nova. Chaves do JSON `config` usadas aqui:
 * smtp_host, smtp_port, seguranca, usuario, senha, nome_remetente,
 * email_remetente, endereco_exibicao (composto "Nome <email>", que é o que
 * `sendWithSmtp` usa hoje como From), reply_to. Chaves de IMAP e demais
 * campos existentes são preservados no merge.
 *
 * REGRAS:
 * - tenant_id NUNCA vem do cliente: é derivado do perfil do usuário autenticado.
 * - Só admin (ou super_admin) do tenant lê/grava a configuração.
 * - A senha nunca é devolvida ao navegador: a leitura só informa `senhaSalva`.
 *   Em branco no formulário significa "manter a senha atual".
 */

const CANAL = "email" as const;
const TESTE_INTERVALO_MS = 60_000;

const hostSchema = z
  .string()
  .trim()
  .min(1, "Informe o servidor SMTP")
  .max(255)
  .regex(
    /^[a-zA-Z0-9.-]+$/,
    "Servidor SMTP inválido (use apenas o host, ex.: smtp.exemplo.com.br)",
  );

const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido").max(255);

const nomeSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do remetente")
  .max(120)
  .refine((v) => !/[<>"\r\n]/.test(v), "Nome do remetente contém caracteres não permitidos");

const salvarSchema = z.object({
  smtpHost: hostSchema,
  smtpPort: z.union([z.literal(465), z.literal(587)]),
  seguranca: z.enum(["ssl", "starttls"]),
  usuario: z.string().trim().min(1, "Informe o usuário").max(255),
  // Vazio/ausente = manter a senha já salva.
  senha: z.string().max(512).optional(),
  nomeRemetente: nomeSchema,
  emailRemetente: emailSchema,
  responderPara: z.union([z.literal(""), emailSchema]).optional(),
  ativo: z.boolean(),
});

const testarSchema = z.object({
  destinatario: emailSchema,
});

export type TenantSmtpConfigLeitura = {
  configurado: boolean;
  ativo: boolean;
  smtpHost: string;
  smtpPort: 465 | 587;
  seguranca: "ssl" | "starttls";
  usuario: string;
  senhaSalva: boolean;
  nomeRemetente: string;
  emailRemetente: string;
  responderPara: string;
};

type ConfigJson = Record<string, unknown>;

/** Resolve tenant do usuário logado e garante que ele é admin (ou super_admin) desse tenant. */
async function resolverTenantAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  const tenantId = profile?.tenant_id as string | null | undefined;
  if (!tenantId) throw new Error("Perfil de tenant não encontrado");

  const { data: isAdmin } = await supabase.rpc("has_role_in_tenant", {
    _user_id: userId,
    _tenant_id: tenantId,
    _role: "admin",
  });
  const { data: isSuper } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!isAdmin && !isSuper) throw new Error("Apenas administradores podem alterar o e-mail");
  return tenantId;
}

async function lerLinhaCanal(supabase: SupabaseClient<Database>, tenantId: string) {
  const { data } = await supabase
    .from("tenant_atendimento_canal_config")
    .select("config,ativo")
    .eq("tenant_id", tenantId)
    .eq("canal", CANAL)
    .maybeSingle();
  return data ? { config: (data.config ?? {}) as ConfigJson, ativo: Boolean(data.ativo) } : null;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown, padrao: 465 | 587): 465 | 587 => (v === 465 || v === 587 ? v : padrao);

/** Nome + e-mail compostos no formato aceito pelo From do nodemailer. */
function montarRemetente(nome: string, email: string) {
  const nomeLimpo = nome.replace(/[<>"\r\n]/g, "").trim();
  return `"${nomeLimpo}" <${email}>`;
}

/** Remove a senha de qualquer mensagem de erro antes de devolvê-la ao cliente. */
function sanitizarErro(msg: string, senha: string): string {
  let out = senha ? msg.split(senha).join("***") : msg;
  if (out.length > 200) out = `${out.slice(0, 200)}…`;
  return out;
}

export const getTenantSmtpConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TenantSmtpConfigLeitura> => {
    const { supabase, userId } = context;
    const tenantId = await resolverTenantAdmin(supabase, userId);
    const linha = await lerLinhaCanal(supabase, tenantId);
    const cfg = linha?.config ?? {};

    return {
      configurado: Boolean(linha),
      ativo: linha?.ativo ?? false,
      smtpHost: str(cfg.smtp_host),
      smtpPort: num(cfg.smtp_port, 587),
      seguranca: cfg.seguranca === "ssl" ? "ssl" : "starttls",
      usuario: str(cfg.usuario),
      senhaSalva: str(cfg.senha).length > 0,
      nomeRemetente: str(cfg.nome_remetente),
      emailRemetente: str(cfg.email_remetente),
      responderPara: str(cfg.reply_to),
    };
  });

export const salvarTenantSmtpConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salvarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await resolverTenantAdmin(supabase, userId);
    const linha = await lerLinhaCanal(supabase, tenantId);
    const atual = linha?.config ?? {};

    const senhaNova = data.senha?.length ? data.senha : undefined;
    const senhaFinal = senhaNova ?? str(atual.senha);
    if (data.ativo && !senhaFinal) {
      throw new Error("Informe a senha SMTP para ativar o canal");
    }

    const config: ConfigJson = {
      ...atual, // preserva chaves de IMAP e demais campos
      smtp_host: data.smtpHost,
      smtp_port: data.smtpPort,
      seguranca: data.seguranca,
      usuario: data.usuario,
      senha: senhaFinal || null,
      nome_remetente: data.nomeRemetente,
      email_remetente: data.emailRemetente,
      endereco_exibicao: montarRemetente(data.nomeRemetente, data.emailRemetente),
      reply_to: data.responderPara || null,
    };

    const { error } = await supabase.from("tenant_atendimento_canal_config").upsert(
      {
        tenant_id: tenantId,
        canal: CANAL,
        ativo: data.ativo,
        config:
          config as Database["public"]["Tables"]["tenant_atendimento_canal_config"]["Insert"]["config"],
      },
      { onConflict: "tenant_id,canal" },
    );
    if (error) throw new Error("Não foi possível salvar a configuração de e-mail");

    return { ok: true as const };
  });

// Limite de 1 teste por tenant a cada 60s. Controle em memória: o app roda como
// um único processo Node na VPS, então o contador é compartilhado. Se o app
// passar a rodar em múltiplas instâncias, mover para o banco.
const ultimoTestePorTenant = new Map<string, number>();

export const testarTenantSmtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => testarSchema.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true } | { ok: false; motivo: string; aguardarSegundos?: number }> => {
      const { supabase, userId } = context;
      const tenantId = await resolverTenantAdmin(supabase, userId);

      const agora = Date.now();
      const ultimo = ultimoTestePorTenant.get(tenantId);
      if (ultimo !== undefined && agora - ultimo < TESTE_INTERVALO_MS) {
        const aguardar = Math.ceil((TESTE_INTERVALO_MS - (agora - ultimo)) / 1000);
        return {
          ok: false,
          motivo: `Aguarde ${aguardar}s antes de enviar outro teste`,
          aguardarSegundos: aguardar,
        };
      }
      // Registra antes do envio: falhas também contam, para não abrir brecha de abuso.
      ultimoTestePorTenant.set(tenantId, agora);

      const linha = await lerLinhaCanal(supabase, tenantId);
      const cfg = linha?.config ?? {};
      const senha = str(cfg.senha);
      if (!cfg.smtp_host || !cfg.usuario || !senha || !cfg.email_remetente) {
        return { ok: false, motivo: "Salve a configuração de e-mail antes de testar" };
      }

      const seguranca = cfg.seguranca === "ssl" ? "ssl" : "starttls";
      const transporter = nodemailer.createTransport({
        host: str(cfg.smtp_host),
        port: num(cfg.smtp_port, 587),
        secure: seguranca === "ssl",
        requireTLS: seguranca === "starttls",
        auth: { user: str(cfg.usuario), pass: senha },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
      });

      try {
        await transporter.sendMail({
          from:
            str(cfg.endereco_exibicao) ||
            montarRemetente(str(cfg.nome_remetente), str(cfg.email_remetente)),
          to: data.destinatario,
          replyTo: str(cfg.reply_to) || undefined,
          subject: "Teste de configuração de e-mail — imoB365",
          text: "Este é um e-mail de teste. Se você recebeu esta mensagem, o envio pelo seu servidor SMTP está funcionando.",
        });
        return { ok: true };
      } catch (err) {
        const codigo = (err as { code?: string })?.code;
        let motivo: string;
        if (codigo === "EAUTH") {
          motivo = "Falha de autenticação: confira usuário e senha";
        } else if (codigo === "ECONNECTION" || codigo === "ETIMEDOUT" || codigo === "ESOCKET") {
          motivo = "Não foi possível conectar ao servidor SMTP: confira host, porta e segurança";
        } else {
          motivo = sanitizarErro(err instanceof Error ? err.message : "Falha ao enviar", senha);
        }
        return { ok: false, motivo };
      } finally {
        transporter.close();
      }
    },
  );
