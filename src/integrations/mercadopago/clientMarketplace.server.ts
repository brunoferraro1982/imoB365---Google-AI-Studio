// Cliente server-only do Mercado Pago para cobranças de MARKETPLACE — variante
// de client.server.ts que recebe o access_token por parâmetro (o token do
// TENANT conectado via OAuth, não o MERCADOPAGO_ACCESS_TOKEN fixo da
// plataforma). Ver src/lib/mercadopagoOAuth.functions.ts.
import { z } from "zod";

const MP_API_BASE = "https://api.mercadopago.com";

async function mpFetch<T>(path: string, accessToken: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("Erro na API do Mercado Pago (marketplace)", res.status, body);
    const message = body?.message ?? body?.error ?? `Mercado Pago API respondeu ${res.status}`;
    throw new Error(`Mercado Pago: ${message}`);
  }
  return body as T;
}

const MpPaymentSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string(),
  external_reference: z.string().nullable().optional(),
  transaction_amount: z.number().optional(),
  currency_id: z.string().optional(),
});
export type MpMarketplacePayment = z.infer<typeof MpPaymentSchema>;

/**
 * Cria uma preferência de Checkout Pro em nome do vendedor conectado
 * (tenant), com `marketplace_fee` — o valor (absoluto, não percentual) que o
 * Mercado Pago repassa pra conta da PLATAFORMA (a aplicação Marketplace),
 * descontado do valor total antes de cair pro vendedor. Confirmado via
 * documentação oficial: `marketplace_fee` é o campo do Checkout Pro
 * (`/checkout/preferences`) — `application_fee` é o equivalente só do
 * Checkout Transparente (`/v1/payments`), não usado aqui.
 */
export async function createMarketplacePreference(opts: {
  accessToken: string;
  title: string;
  price: number;
  externalReference: string;
  payerEmail: string;
  marketplaceFee: number;
  notificationUrl: string;
  backUrl: string;
}): Promise<{ id: string; init_point: string }> {
  const body = await mpFetch<{ id: string; init_point: string }>(
    "/checkout/preferences",
    opts.accessToken,
    {
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
        marketplace_fee: opts.marketplaceFee,
        external_reference: opts.externalReference,
        payer: { email: opts.payerEmail },
        notification_url: opts.notificationUrl,
        back_urls: {
          success: opts.backUrl,
          pending: opts.backUrl,
          failure: opts.backUrl,
        },
        auto_return: "approved",
      }),
    },
  );
  return body;
}

export async function fetchMarketplacePayment(opts: {
  accessToken: string;
  paymentId: string;
}): Promise<MpMarketplacePayment> {
  const body = await mpFetch<unknown>(
    `/v1/payments/${encodeURIComponent(opts.paymentId)}`,
    opts.accessToken,
    { method: "GET" },
  );
  return MpPaymentSchema.parse(body);
}
