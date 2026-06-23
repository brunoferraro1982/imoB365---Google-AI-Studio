/**
 * imoB365 — Edge Function: convert-trial-to-free
 *
 * Converte um tenant de trial expirado para o plano Free.
 * Chamada por auth-gating.ts quando trial_ends_at < NOW().
 *
 * Body: { tenant_id: string }
 *
 * Ações:
 *   1. Valida que o tenant existe e está em trial
 *   2. Atualiza plan_code = 'free', plan_status = 'free'
 *   3. Registra no audit_log
 *   4. Retorna o novo status
 *
 * Deploy:
 *   npx supabase functions deploy convert-trial-to-free
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Usar service_role para bypassar RLS — operação de sistema
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    // Validar body
    const body = await req.json().catch(() => ({}));
    const { tenant_id } = body as { tenant_id?: string };

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Buscar tenant
    const { data: tenant, error: fetchErr } = await supabase
      .from("tenants")
      .select("id, plan_code, plan_status, trial_ends_at")
      .eq("id", tenant_id)
      .single();

    if (fetchErr || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verificar se realmente expirou
    if (tenant.plan_status !== "trial") {
      return new Response(
        JSON.stringify({
          message: "Tenant não está em trial — nenhuma ação",
          plan_status: tenant.plan_status
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
    const now      = new Date();

    if (trialEnd && trialEnd > now) {
      return new Response(
        JSON.stringify({
          message: "Trial ainda ativo",
          trial_ends_at: tenant.trial_ends_at,
          days_remaining: Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Converter para Free
    const { error: updateErr } = await supabase
      .from("tenants")
      .update({
        plan_code:     "free",
        plan_status:   "free",
        plan_starts_at: now.toISOString(),
        plan_ends_at:  null,
      })
      .eq("id", tenant_id);

    if (updateErr) throw updateErr;

    // 4. Registrar no audit_log
    await supabase
      .from("audit_log")
      .insert({
        tenant_id,
        user_id:    null,                    // operação de sistema
        action:     "plan_change",
        resource:   "tenant",
        resource_id: tenant_id,
        old_value:  { plan_code: tenant.plan_code, plan_status: "trial" },
        new_value:  { plan_code: "free", plan_status: "free" },
        ip_address: req.headers.get("x-forwarded-for") ?? null,
        user_agent: "edge-function/convert-trial-to-free",
      })
      .catch(() => null); // Não bloquear se audit falhar

    console.log(`[convert-trial-to-free] tenant ${tenant_id}: trial → free`);

    return new Response(
      JSON.stringify({
        success:    true,
        tenant_id,
        plan_code:  "free",
        plan_status: "free",
        converted_at: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[convert-trial-to-free] erro:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
