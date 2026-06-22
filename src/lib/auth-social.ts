/**
 * imoB365 — Auth Social (OAuth unificado)
 *
 * Segurança:
 * - Providers ativos: google, linkedin_oidc, facebook
 * - Instagram: usa facebook (Meta) — não é provider nativo
 * - Apple: desabilitado até Apple Developer estar configurado
 * - redirectTo: somente URLs na allowlist do Supabase Dashboard
 *   → Authentication > URL Configuration (NUNCA wildcard)
 * - PKCE ativo por padrão no supabase-js v2
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SocialProvider = "google" | "linkedin_oidc" | "facebook";

export async function signInWithSocial(provider: SocialProvider): Promise<void> {
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
