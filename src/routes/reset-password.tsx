import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/routes/index";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — imob365" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase coloca o usuário em sessão temporária ao abrir o link de recovery.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return toast.error("A senha deve ter pelo menos 8 caracteres");
    if (senha !== confirm) return toast.error("As senhas não coincidem");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada");
    navigate({ to: "/conta" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Redefinir senha</h1>
        </div>
        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Abra o link de redefinição que enviamos por e-mail para continuar.
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6"
          >
            <div>
              <Label className="text-xs">Nova senha</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div>
              <Label className="text-xs">Confirmar senha</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Salvando…" : "Atualizar senha"}
            </Button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
