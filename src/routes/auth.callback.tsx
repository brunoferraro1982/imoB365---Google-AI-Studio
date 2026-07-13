import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

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
          .select("tipo_usuario, aprovado")
          .eq("id", user.id)
          .maybeSingle();

        // Erro real de consulta (rede/RLS) é diferente de "usuário novo, sem
        // profile ainda" — tratar os dois igual mandaria um usuário existente,
        // cuja consulta só falhou, de volta para o onboarding por engano.
        if (profileErr) throw profileErr;

        if (!profile?.tipo_usuario) {
          void navigate({ to: "/onboarding", replace: true });
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
