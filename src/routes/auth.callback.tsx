import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerAsClient } from "@/lib/onboarding.functions";
import { consumeProfessionalSignupIntent } from "@/lib/signupIntent";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, follow" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const registerAsClientFn = useServerFn(registerAsClient);

  useEffect(() => {
    void (async () => {
      try {
        // Exchange PKCE code for session (Supabase handles this automatically)
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) throw sessionErr;

        if (!session) {
          void navigate({ to: "/", replace: true });
          return;
        }

        const user = session.user;

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("nome, tipo_usuario, aprovado")
          .eq("id", user.id)
          .maybeSingle();

        // Erro real de consulta (rede/RLS) é diferente de "usuário novo, sem
        // profile ainda" — tratar os dois igual mandaria um usuário existente,
        // cuja consulta só falhou, de volta para o onboarding por engano.
        if (profileErr) throw profileErr;

        if (!profile?.tipo_usuario) {
          // Sinal de intenção profissional só existe quando o usuário veio do
          // branch "corretor/imobiliária" do /signup (marcado em localStorage
          // antes do redirect OAuth, já que o roundtrip perde estado React).
          // Sem esse sinal, todo cadastro novo vira cliente por padrão — mesmo
          // padrão das plataformas de referência (Zillow, Redfin, QuintoAndar,
          // VivaReal): virar profissional é sempre opt-in e posterior.
          if (consumeProfessionalSignupIntent()) {
            void navigate({ to: "/onboarding", replace: true });
            return;
          }

          const nome =
            profile?.nome ||
            (user.user_metadata?.nome as string | undefined) ||
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            user.email?.split("@")[0] ||
            "Cliente";

          await registerAsClientFn({ data: { nome } });
          void navigate({ to: "/conta", replace: true });
          return;
        }

        if (!profile.aprovado) {
          void navigate({ to: "/pending-approval", replace: true });
          return;
        }

        void navigate({ to: "/app", replace: true });
      } catch (err: any) {
        toast.error(
          err?.message ?? "Não foi possível carregar seu perfil. Tente entrar novamente.",
        );
        void navigate({ to: "/login", replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma única vez no mount; registerAsClientFn não deve reiniciar o efeito
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground font-medium">Autenticando…</p>
      </div>
    </div>
  );
}
