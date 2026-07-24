import { supabase } from "@/integrations/supabase/client";

// Achado de segurança de 2026-07-24: MFA existia na UI (app.configuracoes.
// seguranca.tsx) mas nunca era exigido no login — a sessão completa era
// liberada só com senha, mesmo pra quem já tinha um fator TOTP verificado.
// Este helper centraliza a checagem pós-login: se o usuário tem um fator
// verificado e a sessão ainda está em aal1 (precisa subir pra aal2), retorna
// o factorId pra a UI de login pedir o código antes de liberar o acesso.
export async function getPendingMfaFactorId(): Promise<string | null> {
  // Achado de segurança de 2026-07-25: sem esse try/catch, qualquer falha
  // inesperada aqui (rede, RLS, etc.) rejeitava a promise sem tratamento em
  // AppShell.tsx, deixando a página travada em "Carregando..." pra sempre —
  // bloqueava TODO usuário, não só quem tem MFA. Falha aqui deve liberar o
  // acesso (fail-open), nunca travar o app inteiro — RLS continua sendo a
  // barreira real de segurança, este gate é uma camada extra.
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return null;
    if (data.currentLevel === "aal2" || data.nextLevel !== "aal2") return null;

    // Coluna já existia em `profiles` (achado durante este fix, nunca usada em
    // nenhum código nem migration versionada — mesmo padrão de drift já
    // documentado no CLAUDE.md) e cobre exatamente o caso já descrito lá:
    // `imob365br@gmail.com` com `mfa_exempt = true` durante a transição.
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("mfa_exempt")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profile?.mfa_exempt) return null;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.find((f) => f.status === "verified");
    return totp?.id ?? null;
  } catch (err) {
    console.error("[mfaGate] Falha ao checar MFA pendente, liberando acesso:", err);
    return null;
  }
}

export async function verifyMfaChallenge(factorId: string, code: string) {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) return { error: challenge.error };
  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  return { error: verify.error };
}
