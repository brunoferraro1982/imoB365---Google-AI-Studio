import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { User as UserIcon, Save, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadTenantBrandingImage } from "@/lib/tenantBranding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/conta/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — imob365" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user, profile, tenantId } = useAuth();
  const isCorretor = profile?.tipo_usuario === "corretor";
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);

  useEffect(() => {
    setNome(profile?.nome ?? "");
  }, [profile?.nome]);

  useEffect(() => {
    if (!tenantId || !isCorretor) return;
    supabase
      .from("tenants")
      .select("tema")
      .eq("id", tenantId)
      .maybeSingle()
      .then(({ data }) => {
        setFotoUrl((data?.tema as { logo_url?: string } | null)?.logo_url ?? "");
      });
  }, [tenantId, isCorretor]);

  async function uploadFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    setUploadingFoto(true);
    try {
      const url = await uploadTenantBrandingImage(tenantId, file);
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("tema")
        .eq("id", tenantId)
        .maybeSingle();
      const tema = { ...((tenantRow?.tema as object) ?? {}), logo_url: url };
      // .select() é necessário aqui: sem ele, um UPDATE bloqueado pela RLS
      // (0 linhas afetadas) retorna error: null do mesmo jeito — a Meta/
      // Postgres não trata "0 linhas alteradas" como erro. Achado real em
      // produção: um corretor autônomo sem role admin via "Foto atualizada"
      // (falso positivo) 3 vezes seguidas, mas tenants.tema nunca mudava.
      const { data: updated, error } = await supabase
        .from("tenants")
        .update({ tema })
        .eq("id", tenantId)
        .select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error(
          "Não foi possível salvar — você pode não ter permissão de administrador neste espaço.",
        );
      }
      setFotoUrl(url);
      toast.success("Foto atualizada");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingFoto(false);
    }
  }

  async function removerFoto() {
    if (!tenantId) return;
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("tema")
      .eq("id", tenantId)
      .maybeSingle();
    const tema = { ...((tenantRow?.tema as object) ?? {}), logo_url: undefined };
    const { data: updated, error } = await supabase
      .from("tenants")
      .update({ tema })
      .eq("id", tenantId)
      .select("id");
    if (error) return toast.error(error.message);
    if (!updated || updated.length === 0) {
      return toast.error(
        "Não foi possível remover — você pode não ter permissão de administrador neste espaço.",
      );
    }
    setFotoUrl("");
    toast.success("Foto removida");
  }

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

      {isCorretor && (
        <div className="mt-6 max-w-lg rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Sua foto</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Aparece no seu site público e na home do portal.
          </p>
          <div className="mt-4 flex items-center gap-6">
            <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
              {fotoUrl ? (
                <img src={fotoUrl} alt="Foto" className="max-h-20 max-w-36 object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Sem foto</span>
              )}
            </div>
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploadingFoto ? "Enviando…" : "Enviar foto"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={uploadFoto}
                />
              </label>
              {fotoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={removerFoto}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

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
