import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAuthGating } from "@/lib/auth-gating";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      // Exchange PKCE code for session (Supabase handles this automatically)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        void navigate({ to: "/", replace: true });
        return;
      }

      const user = session.user;
      const provider = user.app_metadata?.provider as string | undefined;

      // Email/password users: go straight to app (no onboarding needed)
      if (!provider || provider === "email") {
        void navigate({ to: "/app", replace: true });
        return;
      }

      // OAuth users: check onboarding / approval status
      const { data: profile } = await supabase
        .from("profiles")
        .select("tipo_usuario, status, aprovado")
        .eq("id", user.id)
        .maybeSingle();

      // No tipo_usuario → new OAuth user → onboarding wizard
      if (!profile?.tipo_usuario) {
        void navigate({ to: "/onboarding", replace: true });
        return;
      }

      // Pending approval
      if ((profile as any).status === "pending_approval" || !profile.aprovado) {
        void navigate({ to: "/pending-approval", replace: true });
        return;
      }

      // Approved & complete
      void navigate({ to: "/app", replace: true });
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
