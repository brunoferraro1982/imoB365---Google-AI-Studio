import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createPreapproval,
  createCheckoutPreference,
} from "@/integrations/mercadopago/client.server";
import { z } from "zod";

const checkoutInput = z.object({
  planoSlug: z.enum(["basic", "standard", "pro"]),
  ciclo: z.enum(["monthly", "annual"]),
});

export const createMercadoPagoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(checkoutInput)
  .handler(async ({ context, data }) => {
    const { userId } = context;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw new Error("Erro ao carregar perfil: " + profileError.message);
    if (!profile?.tenant_id) throw new Error("Usuário sem imobiliária vinculada.");

    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("slug, nome, preco_mensal, preco_anual, mp_anual_cobranca_avulsa")
      .eq("slug", data.planoSlug)
      .maybeSingle();
    if (planError) throw new Error("Erro ao carregar plano: " + planError.message);
    if (!plan) throw new Error("Plano não encontrado.");

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !authUser?.user?.email) {
      throw new Error("Não foi possível identificar o e-mail do usuário.");
    }
    const payerEmail = authUser.user.email;

    const baseUrl = process.env.APP_URL || process.env.SITE_URL;
    if (!baseUrl) throw new Error("APP_URL não configurada.");
    const backUrl = `${baseUrl}/app/contratacao`;

    let checkoutUrl: string;

    if (data.ciclo === "annual" && plan.mp_anual_cobranca_avulsa) {
      // Caso avulso: hoje só o Pro anual — Checkout Pro clássico, sem preapproval_plan.
      const preference = await createCheckoutPreference({
        title: `imob365 - Plano ${plan.nome} (anual)`,
        price: Number(plan.preco_anual ?? plan.preco_mensal * 12),
        externalReference: profile.tenant_id,
        payerEmail,
        backUrl,
      });
      checkoutUrl = preference.init_point;
    } else {
      // Assinatura sem plano associado (ver client.server.ts): preapproval_plan_id
      // exigiria card_token_id na criação via API, o que não temos aqui - o valor
      // e a frequência são enviados inline. external_reference carrega
      // tenantId:planoSlug:ciclo para o webhook conseguir ativar o plano certo
      // sem depender de um preapproval_plan_id.
      const transactionAmount =
        data.ciclo === "annual"
          ? Number(plan.preco_anual ?? plan.preco_mensal * 12)
          : Number(plan.preco_mensal);
      const preapproval = await createPreapproval({
        reason: `imob365 - Plano ${plan.nome} (${data.ciclo === "annual" ? "anual" : "mensal"})`,
        transactionAmount,
        frequency: data.ciclo === "annual" ? 12 : 1,
        externalReference: `${profile.tenant_id}:${plan.slug}:${data.ciclo}`,
        payerEmail,
        backUrl,
      });
      if (!preapproval.init_point) {
        throw new Error("Mercado Pago não retornou o link de checkout.");
      }
      checkoutUrl = preapproval.init_point;
    }

    await supabaseAdmin
      .from("tenants")
      .update({ payment_status: "pending", plan_cycle: data.ciclo })
      .eq("id", profile.tenant_id);

    return { checkoutUrl };
  });
