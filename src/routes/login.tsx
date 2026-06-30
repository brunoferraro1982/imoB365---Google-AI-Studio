import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/auth/callback" });
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
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground font-sans">
          Ainda não tem conta?{" "}
          <Link to="/signup" className="text-primary hover:underline font-semibold font-sans">
            Criar conta
          </Link>
        </p>

        {/* Nota: autenticação social (Google, Apple) será implementada via Supabase OAuth em release futura. */}
      </div>
    </div>
  );
}
