import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook genérico de assinatura eletrônica (CLM Sprint 9) — harness BYO:
// cada tenant conecta seu próprio provedor (DocuSign/Clicksign/ZapSign/
// gov.br/ICP-Brasil), configurado em tenant_assinatura_config. Diferente do
// webhook do Mercado Pago (segredo único global via env var), aqui o segredo
// é por tenant — por isso a URL exige ?tenant_id= (o tenant cadastra essa
// URL completa no painel do próprio provedor).
//
// Contrato do payload esperado (definido por este harness, já que não existe
// integração real de nenhum provedor específico ainda — cada integração real
// precisará adaptar o payload do provedor pra este formato antes de postar
// aqui, ou este endpoint evolui por provedor quando o primeiro for integrado
// de verdade):
//   { referencia_externa: string, status: "enviado" | "assinado" }
// Assinatura HMAC-SHA256 do corpo bruto (hex) no header x-assinatura-signature.

function verificarAssinatura(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signatureHeader, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/webhooks/assinatura/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const url = new URL(request.url);
        const tenantId = url.searchParams.get("tenant_id");
        if (!tenantId) {
          return Response.json({ error: "tenant_id ausente na URL" }, { status: 400 });
        }

        const { data: config } = await supabaseAdmin
          .from("tenant_assinatura_config")
          .select("provider,webhook_secret,ativo")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!config || !config.ativo || config.provider !== params.provider) {
          return Response.json({ error: "Integração não configurada" }, { status: 404 });
        }
        if (!config.webhook_secret) {
          console.error(`tenant_assinatura_config sem webhook_secret (tenant ${tenantId})`);
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const rawBody = await request.text();
        const valida = verificarAssinatura(
          rawBody,
          request.headers.get("x-assinatura-signature"),
          config.webhook_secret,
        );
        if (!valida) {
          return Response.json({ error: "Assinatura inválida" }, { status: 401 });
        }

        let payload: { referencia_externa?: string; status?: string } = {};
        try {
          payload = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }

        if (
          !payload.referencia_externa ||
          !["enviado", "assinado"].includes(payload.status ?? "")
        ) {
          return Response.json({ error: "Payload incompleto" }, { status: 400 });
        }

        const { data: parte, error } = await supabaseAdmin
          .from("contrato_partes")
          .update({ assinatura_status: payload.status })
          .eq("tenant_id", tenantId)
          .eq("assinatura_referencia_externa", payload.referencia_externa)
          .select("id,contrato_id")
          .maybeSingle();

        if (error) {
          console.error("Erro ao processar webhook de assinatura", error);
          return Response.json({ error: "Erro ao atualizar parte" }, { status: 500 });
        }

        // contratos.assinatura_status é recalculado automaticamente pelo
        // trigger tg_contrato_partes_derivar_assinatura — nada a fazer aqui.
        return Response.json({ ok: true, matched: !!parte });
      },
    },
  },
});
