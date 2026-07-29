import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CanalWhatsAppConfig = {
  instance_url?: string;
  instance_name?: string;
  api_key?: string;
};

/**
 * Envia por WhatsApp a última resposta não-interna de um chamado ao
 * solicitante, usando a instância Evolution API do próprio tenant dono
 * do balcão (nunca uma instância compartilhada da imoB365 — ver memória
 * "imob365-tenant-autonomy-byo-credentials"). Best-effort, mesmo padrão
 * de enviarEmailChamado: retorna {enviado:false, motivo} em vez de
 * lançar erro quando o canal não está configurado.
 *
 * Endpoint/payload seguem o contrato público documentado do Evolution
 * API (`POST {instance_url}/message/sendText/{instance_name}`,
 * `{number, text}`, header `apikey`) — não testado contra uma instância
 * real nesta sessão (nenhuma disponível); validar formato exato assim
 * que o primeiro tenant conectar uma instância de verdade.
 */
export const enviarWhatsAppChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chamadoId: string }) =>
    z.object({ chamadoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: chamado } = await supabase
      .from("chamados")
      .select("id,tenant_id,responsavel_tipo,solicitante_telefone")
      .eq("id", data.chamadoId)
      .maybeSingle();
    if (!chamado) return { enviado: false, motivo: "Chamado não encontrado" };
    if (!chamado.solicitante_telefone) {
      return { enviado: false, motivo: "Sem telefone do solicitante" };
    }

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
      .eq("canal", "whatsapp")
      .maybeSingle();
    if (!canal?.ativo) return { enviado: false, motivo: "Canal de WhatsApp não configurado" };

    const cfg = canal.config as CanalWhatsAppConfig;
    if (!cfg.instance_url || !cfg.instance_name || !cfg.api_key) {
      return { enviado: false, motivo: "Configuração de WhatsApp incompleta" };
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
      const url = `${cfg.instance_url.replace(/\/$/, "")}/message/sendText/${cfg.instance_name}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.api_key },
        body: JSON.stringify({
          number: chamado.solicitante_telefone,
          text: ultimaMensagem.conteudo,
        }),
      });
      if (!res.ok) {
        return { enviado: false, motivo: `Evolution API respondeu ${res.status}` };
      }
      return { enviado: true };
    } catch (err) {
      return { enviado: false, motivo: err instanceof Error ? err.message : "Falha ao enviar" };
    }
  });
