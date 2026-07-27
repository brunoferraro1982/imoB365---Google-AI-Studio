import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createMarketplacePreference } from "@/integrations/mercadopago/clientMarketplace.server";

// Fase 3 (parte 2) do módulo Financeiro — cobrança real via Mercado Pago
// Marketplace, usando o access_token do tenant conectado (ver
// mercadopagoOAuth.functions.ts) pra gerar um link de pagamento (Checkout
// Pro) cobrando o cliente final da imobiliária, descontando a comissão da
// plataforma via `marketplace_fee`.
//
// `criarCobrancaInterna` é exportada (função solta, sem createServerFn) pra
// ser reaproveitada tanto pelo botão manual (via createServerFn abaixo)
// quanto pelo cron automático (api.public.cron.gerar-cobrancas-mercadopago.ts)
// — sem duplicar a lógica de cálculo de comissão/chamada à API do Mercado
// Pago em dois lugares. Só usa fetch()/Supabase (isomorfo), sem nenhuma API
// exclusiva do Node — diferente do incidente já documentado com
// node:crypto, não há risco de quebrar o bundle do client mesmo que uma
// rota client-side venha a importar este arquivo no futuro.

type OrigemTipo = "parcela" | "lancamento";

async function resolveTenantId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Usuário sem imobiliária vinculada");
  return profile.tenant_id;
}

export async function criarCobrancaInterna(opts: {
  tenantId: string;
  origemTipo: OrigemTipo;
  origemId: string;
  criadoPor: string | null;
}): Promise<{ linkPagamento: string }> {
  const { tenantId, origemTipo, origemId, criadoPor } = opts;

  const { data: conta } = await (supabaseAdmin as any)
    .from("tenant_mercadopago_accounts")
    .select("access_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!conta?.access_token) {
    throw new Error("Conecte a conta do Mercado Pago em Configurações antes de cobrar.");
  }

  const { data: existente } = await (supabaseAdmin as any)
    .from("cobrancas_mercadopago")
    .select("id")
    .eq("origem_tipo", origemTipo)
    .eq("origem_id", origemId)
    .eq("status", "pendente")
    .maybeSingle();
  if (existente) {
    throw new Error("Já existe uma cobrança pendente para este item.");
  }

  let valor: number;
  let contratoId: string;
  let descricao: string;

  if (origemTipo === "parcela") {
    const { data: parcela } = await (supabaseAdmin as any)
      .from("contrato_parcelas")
      .select("valor,status,contrato_id,tipo,numero")
      .eq("id", origemId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!parcela) throw new Error("Parcela não encontrada");
    if (parcela.status === "pago") throw new Error("Parcela já está paga");
    if (!parcela.contrato_id) throw new Error("Parcela sem contrato vinculado");
    valor = Number(parcela.valor);
    contratoId = parcela.contrato_id;
    descricao = `Parcela #${parcela.numero} (${parcela.tipo})`;
  } else {
    const { data: lancamento } = await (supabaseAdmin as any)
      .from("lancamentos_financeiros")
      .select("valor,status,contrato_id,tipo,descricao")
      .eq("id", origemId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!lancamento) throw new Error("Lançamento não encontrado");
    if (lancamento.tipo !== "receita") {
      throw new Error("Só é possível cobrar lançamentos de receita");
    }
    if (lancamento.status === "pago") throw new Error("Lançamento já está pago");
    if (!lancamento.contrato_id) {
      throw new Error("Lançamento sem contrato vinculado — não é possível identificar o pagador");
    }
    valor = Number(lancamento.valor);
    contratoId = lancamento.contrato_id;
    descricao = lancamento.descricao || "Cobrança";
  }

  const { data: contrato } = await (supabaseAdmin as any)
    .from("contratos")
    .select("tipo")
    .eq("id", contratoId)
    .maybeSingle();
  const papel = contrato?.tipo === "locacao" ? "locatario" : "comprador";

  const { data: parte } = await (supabaseAdmin as any)
    .from("contrato_partes")
    .select("nome,email,telefone")
    .eq("contrato_id", contratoId)
    .eq("papel", papel)
    .maybeSingle();
  if (!parte?.email) {
    const rotulo = papel === "locatario" ? "locatário" : "comprador";
    throw new Error(`Cadastre o ${rotulo} nas partes do contrato (com e-mail) antes de cobrar.`);
  }

  const { data: tenant } = await (supabaseAdmin as any)
    .from("tenants")
    .select("plano_slug,mp_comissao_percentual")
    .eq("id", tenantId)
    .maybeSingle();
  let planFee = 0;
  if (tenant?.plano_slug) {
    const { data: plan } = await (supabaseAdmin as any)
      .from("plans")
      .select("mp_comissao_percentual")
      .eq("slug", tenant.plano_slug)
      .maybeSingle();
    planFee = Number(plan?.mp_comissao_percentual ?? 0);
  }
  const feePercent = tenant?.mp_comissao_percentual ?? planFee;
  const marketplaceFee = Math.round(valor * (Number(feePercent) / 100) * 100) / 100;

  const { data: cobranca, error: insertError } = await (supabaseAdmin as any)
    .from("cobrancas_mercadopago")
    .insert({
      tenant_id: tenantId,
      origem_tipo: origemTipo,
      origem_id: origemId,
      contrato_id: contratoId,
      valor,
      marketplace_fee: marketplaceFee,
      criado_por: criadoPor,
    })
    .select("id")
    .single();
  if (insertError || !cobranca) {
    if ((insertError as any)?.code === "23505") {
      throw new Error("Já existe uma cobrança pendente para este item.");
    }
    throw new Error(insertError?.message ?? "Falha ao registrar cobrança");
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL não configurada");

  try {
    // O id da cobrança vai embutido na própria notification_url (em vez de
    // depender só do external_reference) — evita ter que descobrir qual
    // token de tenant usar pra buscar o pagamento antes mesmo de saber de
    // qual tenant se trata. Mesmo padrão que a própria documentação do
    // Mercado Pago recomenda pra marketplaces com múltiplas contas
    // conectadas (parâmetro de identificação na notification_url).
    const preference = await createMarketplacePreference({
      accessToken: conta.access_token,
      title: descricao,
      price: valor,
      externalReference: cobranca.id,
      payerEmail: parte.email,
      marketplaceFee,
      notificationUrl: `${appUrl}/api/public/webhooks/mercadopago-marketplace?cobranca=${cobranca.id}`,
      backUrl: appUrl,
    });
    await (supabaseAdmin as any)
      .from("cobrancas_mercadopago")
      .update({ mp_preference_id: preference.id, link_pagamento: preference.init_point })
      .eq("id", cobranca.id);
    return { linkPagamento: preference.init_point };
  } catch (err) {
    await (supabaseAdmin as any)
      .from("cobrancas_mercadopago")
      .update({ status: "falhou" })
      .eq("id", cobranca.id);
    throw err;
  }
}

const origemInput = z.object({
  origemTipo: z.enum(["parcela", "lancamento"]),
  origemId: z.string().uuid(),
});

export const criarCobrancaMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(origemInput)
  .handler(async ({ context, data }) => {
    const tenantId = await resolveTenantId(context.supabase, context.userId);
    return criarCobrancaInterna({
      tenantId,
      origemTipo: data.origemTipo,
      origemId: data.origemId,
      criadoPor: context.userId,
    });
  });

export type CobrancaMercadoPagoStatus = {
  existe: boolean;
  status: string | null;
  linkPagamento: string | null;
};

export const getCobrancaMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(origemInput)
  .handler(async ({ context, data }): Promise<CobrancaMercadoPagoStatus> => {
    const tenantId = await resolveTenantId(context.supabase, context.userId);
    const { data: cobranca } = await (supabaseAdmin as any)
      .from("cobrancas_mercadopago")
      .select("status,link_pagamento")
      .eq("tenant_id", tenantId)
      .eq("origem_tipo", data.origemTipo)
      .eq("origem_id", data.origemId)
      .eq("status", "pendente")
      .maybeSingle();
    return {
      existe: !!cobranca,
      status: cobranca?.status ?? null,
      linkPagamento: cobranca?.link_pagamento ?? null,
    };
  });

const configAutomaticaInput = z.object({
  ativa: z.boolean(),
  diasAntes: z.number().int().min(1).max(30),
});

export const atualizarConfigCobrancaAutomatica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(configAutomaticaInput)
  .handler(async ({ context, data }) => {
    const tenantId = await resolveTenantId(context.supabase, context.userId);
    const { error } = await (supabaseAdmin as any)
      .from("tenant_mercadopago_accounts")
      .update({
        cobranca_automatica_ativa: data.ativa,
        cobranca_automatica_dias_antes: data.diasAntes,
      })
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
