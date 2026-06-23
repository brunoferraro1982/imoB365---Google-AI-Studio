/**
 * imoB365 — useMfaGuard
 *
 * Verifica se o usuário atual precisa configurar/confirmar MFA.
 *
 * Hierarquia:
 *   mfa_exempt = TRUE  → nunca exige MFA (super admin em dev)
 *   mfa_required = TRUE → exige AAL2 (TOTP configurado e verificado)
 *   caso contrário       → MFA opcional
 *
 * Retorna:
 *   mfaRequired: boolean   — deve bloquear navegação
 *   mfaSetupDone: boolean  — TOTP já cadastrado
 *   checking: boolean      — carregando
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MfaGuardState {
  mfaRequired: boolean;
  mfaSetupDone: boolean;
  checking: boolean;
  exempt: boolean;
}

export function useMfaGuard(userId: string | null | undefined): MfaGuardState {
  const [state, setState] = useState<MfaGuardState>({
    mfaRequired: false,
    mfaSetupDone: false,
    checking: true,
    exempt: false,
  });

  useEffect(() => {
    if (!userId) {
      setState(s => ({ ...s, checking: false }));
      return;
    }

    let cancelled = false;

    async function check() {
      // 1. Verificar flags no profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("mfa_required, mfa_exempt")
        .eq("id", userId!)
        .single();

      if (cancelled) return;

      const exempt = profile?.mfa_exempt === true;
      const required = profile?.mfa_required === true;

      if (exempt || !required) {
        setState({ mfaRequired: false, mfaSetupDone: true, checking: false, exempt });
        return;
      }

      // 2. Verificar AAL atual da sessão
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;

      const currentAal = aalData?.currentLevel;
      const nextAal = aalData?.nextLevel;

      // 3. Verificar se já tem TOTP cadastrado
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;

      const hasTotp = (factors?.totp?.length ?? 0) > 0;

      setState({
        mfaRequired: required && !exempt,
        mfaSetupDone: hasTotp && currentAal === "aal2",
        checking: false,
        exempt,
      });
    }

    void check();
    return () => { cancelled = true; };
  }, [userId]);

  return state;
}
