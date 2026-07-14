// Cliente server-only do Mercado Pago (assinaturas + Checkout Pro).
// SECURITY: MERCADOPAGO_ACCESS_TOKEN nunca deve ser exposto ao cliente — importar
// este arquivo somente em server functions / rotas de servidor.
import { z } from "zod";

const MP_API_BASE = "https://api.mercadopago.com";

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "MERCADOPAGO_ACCESS_TOKEN não configurada. Configure via variável de ambiente do servidor.",
    );
  }
  return token;
}

async function mpFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? `Mercado Pago API respondeu ${res.status}`;
    throw new Error(`Mercado Pago: ${message}`);
  }
  return body as T;
}

const PreapprovalSchema = z.object({
  id: z.string(),
  status: z.string(),
  external_reference: z.string().nullable().optional(),
  preapproval_plan_id: z.string().nullable().optional(),
  init_point: z.string().optional(),
});
export type Preapproval = z.infer<typeof PreapprovalSchema>;

const PaymentSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string(),
  external_reference: z.string().nullable().optional(),
});
export type MpPayment = z.infer<typeof PaymentSchema>;

/**
 * Cria uma assinatura (preapproval) a partir de um preapproval_plan_id já
 * configurado no painel do Mercado Pago. Devolve init_point para o usuário
 * completar a autorização (cartão) no checkout hospedado do Mercado Pago.
 */
export async function createPreapproval(opts: {
  preapprovalPlanId: string;
  externalReference: string;
  payerEmail: string;
  backUrl: string;
}): Promise<Preapproval> {
  const body = await mpFetch<unknown>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      preapproval_plan_id: opts.preapprovalPlanId,
      external_reference: opts.externalReference,
      payer_email: opts.payerEmail,
      back_url: opts.backUrl,
      status: "pending",
    }),
  });
  return PreapprovalSchema.parse(body);
}

export async function fetchPreapproval(id: string): Promise<Preapproval> {
  const body = await mpFetch<unknown>(`/preapproval/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  return PreapprovalSchema.parse(body);
}

/**
 * Cria uma cobrança avulsa (Checkout Pro clássico) — usado só para o Pro anual,
 * que não tem preapproval_plan configurado no Mercado Pago.
 */
export async function createCheckoutPreference(opts: {
  title: string;
  price: number;
  externalReference: string;
  payerEmail: string;
  backUrl: string;
}): Promise<{ id: string; init_point: string }> {
  const body = await mpFetch<{ id: string; init_point: string }>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          title: opts.title,
          quantity: 1,
          unit_price: opts.price,
          currency_id: "BRL",
        },
      ],
      external_reference: opts.externalReference,
      payer: { email: opts.payerEmail },
      back_urls: {
        success: opts.backUrl,
        pending: opts.backUrl,
        failure: opts.backUrl,
      },
      auto_return: "approved",
    }),
  });
  return body;
}

export async function fetchPayment(id: string): Promise<MpPayment> {
  const body = await mpFetch<unknown>(`/v1/payments/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  return PaymentSchema.parse(body);
}
