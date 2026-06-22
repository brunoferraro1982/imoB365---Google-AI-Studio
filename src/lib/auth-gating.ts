/**
 * imoB365 — Auth Gating: controle de acesso pós-login
 *
 * Hierarquia de resolução:
 * 1. Email não verificado          → /conta/verificar-email
 * 2. Status = pendente (pago)      → /pending-approval
 * 3. Plano vencido/cancelado       → /conta/plano-vencido
 * 4. Inadimplente                  → /conta/pagamento-pendente
 * 5. Sem plano (fallback free)     → acesso com limites do Free
 * 6. OK                            → /app/dashboard
 */

import { supabase } from "@/integrations/supabase/client";

export type PlanStatus = "trial" | "active" | "past_due" | "canceled" | "suspended" | "free";

export interface GatingResult {
  redirect: string | null;  // null = prosseguir normalmente
  reason: string;
}

/**
 * Verifica o estado do usuário após login e retorna o redirect correto.
 * Chamado em auth.callback.tsx e no AppShell.
 */
export async function resolveAuthGating(userId: string): Promise<GatingResult> {
  // Buscar profile + tenant em uma query só (RLS garante isolamento)
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      id,
      aprovado,
      email_verified,
      plano_pretendido,
      tipo_usuario,
      mfa_required,
      mfa_exempt,
      tenant:tenants (
        plan_code,
        plan_status,
        trial_ends_at,
        plan_ends_at
      )
    `)
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return { redirect: "/login?error=profile_not_found", reason: "profile_not_found" };
  }

  // ── 1. E-mail não verificado ────────────────────────────────────────────
  if (profile.email_verified === false) {
    return { redirect: "/conta/verificar-email", reason: "email_not_verified" };
  }

  // ── 2. Aguardando aprovação (plano pago) ────────────────────────────────
  // aprovado = FALSE e plano_pretendido != free → na fila
  if (!profile.aprovado && profile.plano_pretendido !== "plan-free") {
    return { redirect: "/pending-approval", reason: "pending_approval" };
  }

  const tenant = Array.isArray(profile.tenant) ? profile.tenant[0] : profile.tenant;

  if (tenant) {
    const now = new Date();
    const planStatus: PlanStatus = tenant.plan_status ?? "free";

    // ── 3. Plano vencido ──────────────────────────────────────────────────
    if (planStatus === "canceled") {
      return { redirect: "/conta/plano-cancelado", reason: "plan_canceled" };
    }

    // ── 4. Inadimplente ───────────────────────────────────────────────────
    if (planStatus === "past_due" || planStatus === "suspended") {
      return { redirect: "/conta/pagamento-pendente", reason: "past_due" };
    }

    // ── Trial expirado ────────────────────────────────────────────────────
    if (planStatus === "trial" && tenant.trial_ends_at) {
      const trialEnd = new Date(tenant.trial_ends_at);
      if (now > trialEnd) {
        // Converter para Free (server-side via edge function)
        await supabase.functions.invoke("convert-trial-to-free", {
          body: { tenant_id: tenant.id ?? null }
        }).catch(() => null); // Não bloquear login se a edge function falhar
        return { redirect: "/app/dashboard?trial_expired=1", reason: "trial_expired" };
      }
    }
  }

  // ── 5. Sem plano → Free automático ────────────────────────────────────
  // (RN-08: usuário sem plano trata como plan-free)

  return { redirect: null, reason: "ok" };
}

/**
 * Determina se um novo usuário vai direto ao painel (Free)
 * ou para fila de aprovação (pago).
 */
export function requiresApproval(planCode: string | null | undefined): boolean {
  if (!planCode || planCode === "plan-free") return false;
  return true; // Basic, Standard, Pro, Business → fila
}

/**
 * Dias restantes de trial. Retorna null se não for trial.
 */
export function trialDaysRemaining(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
