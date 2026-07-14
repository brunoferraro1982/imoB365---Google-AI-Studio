import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchPreapproval, fetchPayment } from "@/integrations/mercadopago/client.server";

// Webhook de notificações do Mercado Pago (assinaturas + pagamentos avulsos).
// Documentação da assinatura: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks
//
// Formato do header x-signature: "ts=<timestamp>,v1=<hash hex>"
// Manifest a assinar: "id:{data.id};request-id:{x-request-id};ts:{ts};"
function verifySignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}): boolean {
  if (!opts.xSignature || !opts.xRequestId) return false;

  const parts = Object.fromEntries(
    opts.xSignature.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${opts.dataId.toLowerCase()};request-id:${opts.xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function activateFromPreapproval(preapprovalId: string, tenantId: string) {
  const preapproval = await fetchPreapproval(preapprovalId);
  if (preapproval.status !== "authorized") return { activated: false, status: preapproval.status };

  const preapprovalPlanId = preapproval.preapproval_plan_id;
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("slug, mp_preapproval_plan_id_mensal, mp_preapproval_plan_id_anual")
    .or(
      `mp_preapproval_plan_id_mensal.eq.${preapprovalPlanId},mp_preapproval_plan_id_anual.eq.${preapprovalPlanId}`,
    )
    .maybeSingle();
  if (!plan) return { activated: false, status: "plan_not_found" };

  const cycle = plan.mp_preapproval_plan_id_anual === preapprovalPlanId ? "annual" : "monthly";

  await supabaseAdmin
    .from("tenants")
    .update({
      plano_slug: plan.slug,
      status: "active",
      payment_status: "authorized",
      mercadopago_preapproval_id: preapprovalId,
      plan_cycle: cycle,
      trial_ends_at: null,
      trial_grace_ends_at: null,
    })
    .eq("id", tenantId);

  return { activated: true, status: preapproval.status };
}

async function activateFromPayment(paymentId: string, tenantId: string) {
  const payment = await fetchPayment(paymentId);
  if (payment.status !== "approved") return { activated: false, status: payment.status };

  // Hoje o único combo de cobrança avulsa é o Pro anual (ver migration
  // 20260714180000_mercadopago_subscriptions.sql) — sem renovação automática,
  // por isso grava plan_expires_at explícito.
  await supabaseAdmin
    .from("tenants")
    .update({
      plano_slug: "pro",
      status: "active",
      payment_status: "authorized",
      mercadopago_payment_id: String(paymentId),
      plan_cycle: "annual",
      plan_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      trial_ends_at: null,
      trial_grace_ends_at: null,
    })
    .eq("id", tenantId);

  return { activated: true, status: payment.status };
}

export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!secret) {
          console.error("MERCADOPAGO_WEBHOOK_SECRET não configurada");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const url = new URL(request.url);
        const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "";
        const type = url.searchParams.get("type") ?? "";

        const rawBody = await request.text();
        let payload: any = null;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          // corpo pode vir vazio em alguns eventos — segue só com os query params
        }

        const resourceId = dataId || payload?.data?.id || "";
        const eventType = type || payload?.type || "";
        const notificationId = payload?.id ? String(payload.id) : `${eventType}:${resourceId}`;

        if (!resourceId || !eventType) {
          return Response.json({ error: "Notificação sem id/type" }, { status: 400 });
        }

        const valid = verifySignature({
          xSignature: request.headers.get("x-signature"),
          xRequestId: request.headers.get("x-request-id"),
          dataId: resourceId,
          secret,
        });
        if (!valid) {
          console.error("Assinatura inválida no webhook do Mercado Pago");
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        // Idempotência: grava ANTES de processar. Se já existe, o Mercado Pago
        // reenviou a mesma notificação — responde 200 sem reprocessar.
        const { error: insertError } = await supabaseAdmin.from("payment_events").insert({
          mp_notification_id: notificationId,
          event_type: eventType,
          raw_payload: payload ?? { data: { id: resourceId }, type: eventType },
        });
        if (insertError) {
          if (insertError.code === "23505") {
            return Response.json({ ok: true, duplicate: true });
          }
          console.error("Erro ao gravar payment_events", insertError);
          return Response.json({ error: "Erro ao registrar notificação" }, { status: 500 });
        }

        try {
          let result: { activated: boolean; status: string; tenantId?: string } | null = null;

          if (eventType === "subscription_preapproval") {
            const preapproval = await fetchPreapproval(resourceId);
            const tenantId = preapproval.external_reference;
            if (tenantId) {
              const r = await activateFromPreapproval(resourceId, tenantId);
              result = { ...r, tenantId };
            }
          } else if (eventType === "payment") {
            const payment = await fetchPayment(resourceId);
            const tenantId = payment.external_reference;
            if (tenantId) {
              const r = await activateFromPayment(resourceId, tenantId);
              result = { ...r, tenantId };
            }
          }
          // subscription_authorized_payment (cobrança recorrente já autorizada) e
          // outros tipos: só fica registrado em payment_events por ora, sem ação —
          // a ativação do tenant já aconteceu no evento subscription_preapproval inicial.

          await supabaseAdmin
            .from("payment_events")
            .update({
              processed_at: new Date().toISOString(),
              tenant_id: result?.tenantId ?? null,
            })
            .eq("mp_notification_id", notificationId);

          return Response.json({ ok: true, ...result });
        } catch (err: any) {
          console.error("Erro ao processar webhook do Mercado Pago", err);
          // já gravamos em payment_events antes de tentar — dá pra reprocessar manualmente depois
          return Response.json({ error: "Erro ao processar notificação" }, { status: 500 });
        }
      },
    },
  },
});
