import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchMarketplacePayment } from "@/integrations/mercadopago/clientMarketplace.server";

// Webhook das cobranças de MARKETPLACE (Fase 3 parte 2 do módulo Financeiro)
// — distinto de api.public.webhooks.mercadopago.ts, que é o webhook da
// assinatura SaaS da própria plataforma (usa MERCADOPAGO_ACCESS_TOKEN/
// MERCADOPAGO_WEBHOOK_SECRET fixos). Este resolve o access_token por tenant
// (tenant_mercadopago_accounts) e confirma pagamentos que os TENANTS
// recebem dos próprios clientes finais.
//
// verifySignature duplicada aqui de propósito (não extraída pra um helper
// compartilhado importado pelos dois webhooks) — mesma assinatura HMAC do
// outro webhook, mas evitar um import cruzado entre arquivos de rota reduz
// o raio de qualquer futuro problema de bundling.
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

async function confirmarPagamento(cobrancaId: string, paymentId: string) {
  const { data: cobranca } = await (supabaseAdmin as any)
    .from("cobrancas_mercadopago")
    .select("id,tenant_id,origem_tipo,origem_id,status")
    .eq("id", cobrancaId)
    .maybeSingle();
  if (!cobranca) {
    console.error("[mercadopago-marketplace] cobrança não encontrada", cobrancaId);
    return {
      activated: false,
      status: "cobranca_nao_encontrada",
      amount: null,
      currency: null,
      tenantId: null,
    };
  }
  if (cobranca.status === "pago") {
    return {
      activated: true,
      status: "already_paid",
      amount: null,
      currency: null,
      tenantId: cobranca.tenant_id,
    };
  }

  const { data: conta } = await (supabaseAdmin as any)
    .from("tenant_mercadopago_accounts")
    .select("access_token")
    .eq("tenant_id", cobranca.tenant_id)
    .maybeSingle();
  if (!conta?.access_token) {
    console.error("[mercadopago-marketplace] tenant sem conta conectada", cobranca.tenant_id);
    return {
      activated: false,
      status: "conta_desconectada",
      amount: null,
      currency: null,
      tenantId: cobranca.tenant_id,
    };
  }

  const payment = await fetchMarketplacePayment({ accessToken: conta.access_token, paymentId });
  const amount = payment.transaction_amount ?? null;
  const currency = payment.currency_id ?? "BRL";

  if (payment.status === "approved") {
    await (supabaseAdmin as any)
      .from("cobrancas_mercadopago")
      .update({
        status: "pago",
        mp_payment_id: String(paymentId),
        paid_at: new Date().toISOString(),
      })
      .eq("id", cobrancaId);

    const hoje = new Date().toISOString().slice(0, 10);
    if (cobranca.origem_tipo === "parcela") {
      // Reaproveita o trigger já existente tg_parcela_paga_lancamento — só
      // precisamos fazer o mesmo UPDATE que o "Marcar pago" manual faz.
      await (supabaseAdmin as any)
        .from("contrato_parcelas")
        .update({ status: "pago", data_pagamento: hoje })
        .eq("id", cobranca.origem_id)
        .neq("status", "pago");
    } else {
      await (supabaseAdmin as any)
        .from("lancamentos_financeiros")
        .update({ status: "pago", data_pagamento: hoje })
        .eq("id", cobranca.origem_id)
        .neq("status", "pago");
    }
    return {
      activated: true,
      status: payment.status,
      amount,
      currency,
      tenantId: cobranca.tenant_id,
    };
  }

  if (payment.status === "rejected" || payment.status === "cancelled") {
    await (supabaseAdmin as any)
      .from("cobrancas_mercadopago")
      .update({ status: payment.status === "cancelled" ? "cancelado" : "falhou" })
      .eq("id", cobrancaId);
  }

  return {
    activated: false,
    status: payment.status,
    amount,
    currency,
    tenantId: cobranca.tenant_id,
  };
}

export const Route = createFileRoute("/api/public/webhooks/mercadopago-marketplace")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MERCADOPAGO_MARKETPLACE_WEBHOOK_SECRET;
        if (!secret) {
          console.error("MERCADOPAGO_MARKETPLACE_WEBHOOK_SECRET não configurada");
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
          console.error("Assinatura inválida no webhook de marketplace do Mercado Pago");
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        // Idempotência: grava ANTES de processar (mesmo padrão do webhook da
        // assinatura SaaS) — reenvio da mesma notificação responde 200 sem
        // reprocessar.
        const { error: insertError } = await (supabaseAdmin as any)
          .from("cobrancas_mercadopago_eventos")
          .insert({
            mp_notification_id: notificationId,
            event_type: eventType,
            raw_payload: payload ?? { data: { id: resourceId }, type: eventType },
          });
        if (insertError) {
          if (insertError.code === "23505") {
            return Response.json({ ok: true, duplicate: true });
          }
          console.error("Erro ao gravar cobrancas_mercadopago_eventos", insertError);
          return Response.json({ error: "Erro ao registrar notificação" }, { status: 500 });
        }

        try {
          let result: {
            activated: boolean;
            status: string;
            amount: number | null;
            currency: string | null;
            tenantId?: string | null;
            cobrancaId?: string;
          } | null = null;

          // O id da cobrança vem da própria notification_url (query param
          // `cobranca`, setado na criação da preferência) — não do payload
          // do evento, evitando ter que descobrir qual token de tenant usar
          // pra buscar o pagamento antes mesmo de saber de qual tenant se
          // trata.
          const cobrancaId = url.searchParams.get("cobranca");
          if (eventType === "payment" && cobrancaId) {
            const r = await confirmarPagamento(cobrancaId, resourceId);
            result = { ...r, cobrancaId };
          }
          // Outros tipos de evento (ex. merchant_order) só ficam registrados
          // em cobrancas_mercadopago_eventos por ora, sem ação.

          await (supabaseAdmin as any)
            .from("cobrancas_mercadopago_eventos")
            .update({
              processed_at: new Date().toISOString(),
              cobranca_id: result?.cobrancaId ?? null,
              tenant_id: result?.tenantId ?? null,
            })
            .eq("mp_notification_id", notificationId);

          return Response.json({ ok: true, ...result });
        } catch (err: any) {
          console.error("Erro ao processar webhook de marketplace do Mercado Pago", err);
          return Response.json({ error: "Erro ao processar notificação" }, { status: 500 });
        }
      },
    },
  },
});
