// Propaga a intenção "quero virar profissional" através do roundtrip de
// login social (signInWithOAuth sai do domínio e volta sem preservar
// nenhum estado React) — gravado em /signup antes do redirect, lido uma
// única vez em /auth/callback pra decidir entre completar o onboarding
// profissional (corretor/imobiliária) ou o cadastro simples de cliente.
const KEY = "imob365_signup_intent";

export function markProfessionalSignupIntent() {
  try {
    localStorage.setItem(KEY, "profissional");
  } catch {
    // localStorage indisponível (modo privado restrito, etc.) — sem
    // marcador, o callback trata como cliente por padrão, o caminho
    // mais seguro (nunca cria tenant sem essa confirmação explícita).
  }
}

/** Lê e limpa o marcador — uso único, não deve sobreviver a um segundo login. */
export function consumeProfessionalSignupIntent(): boolean {
  try {
    const value = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return value === "profissional";
  } catch {
    return false;
  }
}
