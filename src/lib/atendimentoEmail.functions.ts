import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import nodemailer from "nodemailer";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CanalEmailConfig = {
  smtp_host?: string;
  smtp_port?: number;
  usuario?: string;
  senha?: string;
  endereco_exibicao?: string;
};

/**
 * Envia por e-mail a última resposta não-interna de um chamado ao
 * solicitante, usando a credencial SMTP do próprio tenant dono do balcão
 * (ou da imoB365, resolvida por slug, quando é o balcão imob365) — nunca
 * uma conta compartilhada da plataforma (ver memória
 * "imob365-tenant-autonomy-byo-credentials"). Best-effort: retorna
 * `{enviado:false, motivo}` em vez de lançar erro quando o canal não está
 * configurado, para não travar o fluxo de resposta no app/admin.
 */
export const enviarEmailChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chamadoId: string }) =>
    z.object({ chamadoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Consulta com o client do próprio usuário — RLS garante que só quem
    // já tem acesso ao chamado (balcão certo / solicitante) chega aqui.
    const { data: chamado } = await supabase
      .from("chamados")
      .select("id,numero,assunto,tenant_id,responsavel_tipo,solicitante_email")
      .eq("id", data.chamadoId)
      .maybeSingle();
    if (!chamado) return { enviado: false, motivo: "Chamado não encontrado" };
    if (!chamado.solicitante_email) return { enviado: false, motivo: "Sem e-mail do solicitante" };

    let tenantIdConfig: string | null = chamado.tenant_id;
    if (chamado.responsavel_tipo === "imob365") {
      const { data: corporate } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("slug", "imob365")
        .maybeSingle();
      tenantIdConfig = corporate?.id ?? null;
    }
    if (!tenantIdConfig) return { enviado: false, motivo: "Sem tenant associado" };

    const { data: canal } = await supabaseAdmin
      .from("tenant_atendimento_canal_config")
      .select("config,ativo")
      .eq("tenant_id", tenantIdConfig)
      .eq("canal", "email")
      .maybeSingle();
    if (!canal?.ativo) return { enviado: false, motivo: "Canal de e-mail não configurado" };

    const cfg = canal.config as CanalEmailConfig;
    if (!cfg.smtp_host || !cfg.usuario || !cfg.senha) {
      return { enviado: false, motivo: "Configuração de e-mail incompleta" };
    }

    const { data: ultimaMensagem } = await supabaseAdmin
      .from("chamado_mensagens")
      .select("conteudo")
      .eq("chamado_id", chamado.id)
      .eq("interno", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ultimaMensagem) return { enviado: false, motivo: "Sem mensagem pra enviar" };

    try {
      const transporter = nodemailer.createTransport({
        host: cfg.smtp_host,
        port: cfg.smtp_port ?? 587,
        secure: cfg.smtp_port === 465,
        auth: { user: cfg.usuario, pass: cfg.senha },
      });
      await transporter.sendMail({
        from: cfg.endereco_exibicao || cfg.usuario,
        to: chamado.solicitante_email,
        subject: `[${chamado.numero}] ${chamado.assunto}`,
        text: ultimaMensagem.conteudo,
      });
      return { enviado: true };
    } catch (err) {
      return { enviado: false, motivo: err instanceof Error ? err.message : "Falha ao enviar" };
    }
  });
