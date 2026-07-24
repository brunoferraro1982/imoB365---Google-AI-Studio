import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { getPendingMfaFactorId, verifyMfaChallenge } from "@/lib/mfaGate";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — imob365" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  // Cobre o caso de o AppShell redirecionar pra cá por já existir uma sessão
  // aal1 pendente (ex.: login feito pelo mega menu, ou aba reaberta) — pula
  // direto pro desafio em vez de pedir e-mail/senha de novo.
  useEffect(() => {
    getPendingMfaFactorId().then((factorId) => {
      if (factorId) setMfaFactorId(factorId);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    const factorId = await getPendingMfaFactorId();
    setLoading(false);
    if (factorId) {
      setMfaFactorId(factorId);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/auth/callback" });
  }

  async function onSubmitMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setMfaLoading(true);
    const { error } = await verifyMfaChallenge(mfaFactorId, mfaCode);
    setMfaLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/auth/callback" });
  }

  async function cancelMfa() {
    await supabase.auth.signOut();
    setMfaFactorId(null);
    setMfaCode("");
    setPassword("");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Informe seu e-mail no campo acima primeiro.");
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link de redefinição enviado para seu e-mail!");
    setShowForgot(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8 relative font-sans">
      {/* LOGIN CARD */}
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center sm:text-left">
          <Link to="/" className="inline-block">
            <Logo className="h-7 w-auto" />
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse o painel integrado do imob365.
          </p>
        </div>

        {mfaFactorId ? (
          <form onSubmit={onSubmitMfa} className="space-y-4 mt-5">
            <p className="text-sm text-muted-foreground">
              Digite o código de 6 dígitos do seu aplicativo autenticador.
            </p>
            <div className="space-y-2">
              <Label htmlFor="mfaCode">Código de verificação</Label>
              <Input
                id="mfaCode"
                inputMode="numeric"
                autoFocus
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
              />
            </div>
            <Button
              type="submit"
              disabled={mfaLoading || mfaCode.length !== 6}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/95"
            >
              {mfaLoading ? "Verificando..." : "Verificar"}
            </Button>
            <button
              type="button"
              onClick={cancelMfa}
              className="w-full text-center text-xs text-muted-foreground hover:underline"
            >
              Cancelar e voltar
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 mt-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@imobiliaria.com"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setShowForgot((v) => !v)}
                >
                  Esqueceu a senha?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
              />
            </div>

            {showForgot && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-2">
                <p className="text-muted-foreground">
                  Enviaremos um link de redefinição para o e-mail informado acima.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={forgotLoading}
                  onClick={handleForgotPassword}
                  className="w-full"
                >
                  {forgotLoading ? "Enviando..." : "Enviar link de redefinição"}
                </Button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/95 mt-5"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            {/* SOCIAL LOGINS */}
            <div className="pt-2">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Ou entre via rede social
                  </span>
                </div>
              </div>
              <SocialLoginButtons />
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground font-sans">
          Ainda não tem conta?{" "}
          <Link to="/signup" className="text-primary hover:underline font-semibold font-sans">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
