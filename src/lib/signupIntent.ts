// Propaga a intenção "quero virar profissional" através do roundtrip de
// login social (signInWithOAuth sai do domínio e volta sem preservar
// nenhum estado React) — gravado em /signup antes do redirect, lido uma
// única vez em /auth/callback pra decidir entre completar o onboarding
// profissional (corretor/imobiliária) ou o cadastro simples de cliente.
// Nome do item no localStorage (não é segredo — só o rótulo da entrada;
// renomeado de "KEY" pra evitar falso positivo da regra generic-api-key do
// Gitleaks no CI, que dispara em variáveis chamadas "key").
const STORAGE_ITEM_NAME = "imob365_signup_intent";

export function markProfessionalSignupIntent() {
  try {
    localStorage.setItem(STORAGE_ITEM_NAME, "profissional");
  } catch {
    // localStorage indisponível (modo privado restrito, etc.) — sem
    // marcador, o callback trata como cliente por padrão, o caminho
    // mais seguro (nunca cria tenant sem essa confirmação explícita).
  }
}

/** Lê e limpa o marcador — uso único, não deve sobreviver a um segundo login. */
export function consumeProfessionalSignupIntent(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_ITEM_NAME);
    localStorage.removeItem(STORAGE_ITEM_NAME);
    return value === "profissional";
  } catch {
    return false;
  }
}
