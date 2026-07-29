import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook genérico de WhatsApp (Evolution API) — harness BYO, mesmo
// princípio do webhook de assinatura eletrônica (CLM Sprint 9): cada
// tenant conecta a própria instância (ver memória
// "imob365-tenant-autonomy-byo-credentials"), configurada em
// tenant_atendimento_canal_config (canal='whatsapp'). A URL exige
// ?tenant_id= (cadastrada no painel da própria instância do tenant como
// webhook do evento MESSAGES_UPSERT) e a request é validada pelo header
// `apikey` batendo com a API key salva pro tenant.
//
// Contrato esperado (evento MESSAGES_UPSERT do Evolution API):
//   { event: "messages.upsert", instance: string,
//     data: { key: { remoteJid: string, fromMe: boolean },
//              message: { conversation?: string, extendedTextMessage?: { text?: string } },
//              pushName?: string } }
// Mensagens enviadas pela própria instância (fromMe=true) são ignoradas —
// senão o envio do agente (Sprint 5, enviarWhatsAppChamado) ecoaria de
// volta como se fosse uma resposta do cliente.

type EvolutionPayload = {
  event?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean };
    message?: { conversation?: string; extendedTextMessage?: { text?: string } };
    pushName?: string;
  };
};

function extrairTexto(payload: EvolutionPayload): string {
  const msg = payload.data?.message;
  return msg?.conversation ?? msg?.extendedTextMessage?.text ?? "";
}

function extrairTelefone(remoteJid: string | undefined): string {
  // remoteJid vem no formato "5513999999999@s.whatsapp.net"
  return (remoteJid ?? "").split("@")[0];
}

export const Route = createFileRoute("/api/public/webhooks/evolution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const tenantId = url.searchParams.get("tenant_id");
        if (!tenantId) {
          return Response.json({ error: "tenant_id ausente na URL" }, { status: 400 });
        }

        const { data: config } = await supabaseAdmin
          .from("tenant_atendimento_canal_config")
          .select("config,ativo")
          .eq("tenant_id", tenantId)
          .eq("canal", "whatsapp")
          .maybeSingle();

        const cfg = config?.config as { api_key?: string } | undefined;
        if (!config?.ativo || !cfg?.api_key) {
          return Response.json({ error: "Canal não configurado" }, { status: 404 });
        }
        if (request.headers.get("apikey") !== cfg.api_key) {
          return Response.json({ error: "apikey inválida" }, { status: 401 });
        }

        let payload: EvolutionPayload = {};
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }

        if (payload.event !== "messages.upsert" || payload.data?.key?.fromMe) {
          return Response.json({ ok: true, ignorado: true });
        }

        const telefone = extrairTelefone(payload.data?.key?.remoteJid);
        const texto = extrairTexto(payload);
        if (!telefone || !texto) {
          return Response.json({ ok: true, ignorado: true });
        }

        // Casa com um chamado em aberto desse telefone nesse tenant; sem
        // match, cria um novo.
        const { data: chamadoAberto } = await supabaseAdmin
          .from("chamados")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("solicitante_telefone", telefone)
          .not("status", "in", "(resolvido,fechado)")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let chamadoId = chamadoAberto?.id ?? null;

        if (!chamadoId) {
          // numero é preenchido pelo trigger tg_chamado_numero (Sprint 0),
          // não faz parte do tipo Insert gerado — cast necessário.
          const { data: novoChamado } = await supabaseAdmin
            .from("chamados")
            .insert({
              responsavel_tipo: "tenant",
              tenant_id: tenantId,
              solicitante_tipo: "cliente_final",
              solicitante_nome: payload.data?.pushName || telefone,
              solicitante_telefone: telefone,
              categoria: "outro",
              canal_origem: "whatsapp",
              assunto: texto.slice(0, 120),
            } as never)
            .select("id")
            .single();
          chamadoId = novoChamado?.id ?? null;
        }

        if (!chamadoId) {
          return Response.json({ error: "Falha ao criar chamado" }, { status: 500 });
        }

        await supabaseAdmin.from("chamado_mensagens").insert({
          chamado_id: chamadoId,
          autor_tipo: "cliente",
          canal: "whatsapp",
          conteudo: texto.slice(0, 4000),
        });

        return Response.json({ ok: true, chamado_id: chamadoId });
      },
    },
  },
});
