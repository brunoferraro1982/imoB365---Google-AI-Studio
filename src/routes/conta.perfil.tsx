import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { User as UserIcon, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/conta/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — imob365" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user, profile } = useAuth();
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNome(profile?.nome ?? "");
  }, [profile?.nome]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (nome.trim().length < 2) return toast.error("Informe seu nome");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error("Não foi possível salvar: " + error.message);
    toast.success("Perfil atualizado");
  }

  async function pedirReset() {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Enviamos um e-mail para você redefinir a senha");
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <UserIcon className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Meu perfil</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Atualize seus dados pessoais e senha.</p>

      <form
        onSubmit={salvar}
        className="mt-8 max-w-lg space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <div>
          <Label className="text-xs">Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={200} />
        </div>
        <div>
          <Label className="text-xs">E-mail</Label>
          <Input value={user?.email ?? ""} disabled />
          <p className="mt-1 text-xs text-muted-foreground">
            Para alterar o e-mail, entre em contato com o suporte.
          </p>
        </div>
        <Button type="submit" disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </form>

      <div className="mt-6 max-w-lg rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Senha</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Enviaremos um link de redefinição para seu e-mail.
        </p>
        <Button type="button" variant="outline" className="mt-3" onClick={pedirReset}>
          Redefinir senha
        </Button>
      </div>
    </div>
  );
}
