/**
 * imoB365 — Auth Social (OAuth unificado)
 *
 * Segurança:
 * - redirectTo: somente URLs na allowlist do Supabase Dashboard (NUNCA wildcard)
 * - PKCE ativo por padrão no supabase-js v2
 *
 * PROVIDERS_ENABLED: controla quais providers estão ativos no Supabase.
 * Providers não listados exibem toast "em breve" sem chamar o OAuth.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SocialProvider = "google" | "linkedin_oidc" | "facebook";

// ── Alterar aqui quando habilitar cada provider no Supabase Dashboard ─────
const PROVIDERS_ENABLED: SocialProvider[] = [
  "google",
  // "linkedin_oidc",  // habilitar quando configurar no Supabase
  // "facebook",       // habilitar quando configurar no Supabase
];

export async function signInWithSocial(provider: SocialProvider): Promise<void> {
  if (!PROVIDERS_ENABLED.includes(provider)) {
    toast.info(`Login via ${PROVIDER_LABELS[provider]} em breve.`);
    return;
  }

  const redirectTo = `${window.location.origin}/auth/callback`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: {
        ...(provider === "google" && { access_type: "offline", prompt: "consent" }),
      },
    },
  });

  if (error) {
    toast.error(`Erro ao conectar com ${PROVIDER_LABELS[provider]}: ${error.message}`);
    console.error("[auth-social]", error);
  }
}

export const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google:        "Google",
  linkedin_oidc: "LinkedIn",
  facebook:      "Facebook",
};
