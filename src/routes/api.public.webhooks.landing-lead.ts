import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { checkRateLimit, getClientIpFromRequest } from "@/lib/rateLimit";
import { baseLeadSchema, ingestLandingLead } from "@/lib/landingLead.server";

// Webhook server-to-server da landing page externa (mkt.imob365.com.br,
// PHP+MySQL na hospedagem compartilhada). O submit-lead.php grava primeiro
// no MySQL dele (fonte da verdade/buffer) e depois envia pra cá; se falhar,
// o cron sync-pendentes.php reenvia — por isso a ingestão é idempotente por
// `external_ref` ("mkt:<id da linha no MySQL>"). A lógica de gravação/aviso
// fica em landingLead.server.ts (compartilhada com as landings /lp/*).
//
// Autenticação: X-Signature: sha256=<HMAC-SHA256 do corpo cru> com
// LANDING_LEAD_SECRET. Falha FECHADA: sem secret configurado, nada entra.

const MAX_SKEW_MS = 10 * 60 * 1000;

const payloadSchema = baseLeadSchema.extend({
  external_ref: z.string().trim().min(1).max(80),
  enviado_em: z.number().int(),
  backfill: z.boolean().optional().default(false),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(header.slice("sha256=".length), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/webhooks/landing-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.LANDING_LEAD_SECRET;
        if (!secret) return json(503, { error: "Integração não configurada" });

        const rl = checkRateLimit(`landing-lead:${getClientIpFromRequest(request)}`, {
          max: 60,
          windowMs: 60_000,
        });
        if (!rl.allowed) return json(429, { error: "Too Many Requests" });

        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers.get("x-signature"), secret)) {
          return json(401, { error: "Assinatura inválida" });
        }

        let lead: z.infer<typeof payloadSchema>;
        try {
          lead = payloadSchema.parse(JSON.parse(rawBody));
        } catch (err) {
          const detalhe = err instanceof z.ZodError ? err.issues.map((i) => i.path.join(".")) : [];
          return json(400, { error: "Payload inválido", campos: detalhe });
        }
        if (Math.abs(Date.now() - lead.enviado_em) > MAX_SKEW_MS) {
          return json(401, { error: "Requisição expirada" });
        }

        const r = await ingestLandingLead({
          ...lead,
          fonte: "mkt_imob365",
          fonteLabel: "mkt.imob365.com.br",
        });
        if (!r.ok) return json(500, { error: r.erro });
        if (r.status === "duplicado")
          return json(200, { ok: true, lead_id: r.leadId, duplicado: true });
        if (r.status === "juntado") {
          return json(200, {
            ok: true,
            lead_id: r.leadId,
            juntado: true,
            email_enviado: r.emailEnviado,
          });
        }
        return json(201, { ok: true, lead_id: r.leadId, email_enviado: r.emailEnviado });
      },
    },
  },
});
