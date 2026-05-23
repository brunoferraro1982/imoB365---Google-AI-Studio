import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, Globe, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes/branding")({
  component: ConfigBranding,
});

type Tema = {
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
};

function ConfigBranding() {
  const { tenantId } = useAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [tema, setTema] = useState<Tema>({});
  const [dominio, setDominio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();
    if (data) {
      setTenant(data);
      setTema((data.tema as Tema) ?? {});
      setDominio(data.dominio_proprio ?? "");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function uploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo deve ter no máximo 2MB");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${tenantId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("tenant-branding").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: pub } = supabase.storage.from("tenant-branding").getPublicUrl(path);
    setTema((t) => ({ ...t, logo_url: pub.publicUrl }));
    setUploading(false);
    toast.success("Logo enviada");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({ tema: tema as any, dominio_proprio: dominio || null })
      .eq("id", tenantId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Marca atualizada");
    load();
  }

  if (loading || !tenant) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  const primary = tema.primary_color || "#0f172a";
  const accent = tema.accent_color || "#3b82f6";

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-base font-semibold">Logotipo</h2>
        <p className="mb-4 text-xs text-muted-foreground">Aparece no site público e em e-mails. PNG/SVG até 2MB.</p>
        <div className="flex items-center gap-6">
          <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            {tema.logo_url ? (
              <img src={tema.logo_url} alt="Logo" className="max-h-20 max-w-36 object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Sem logo</span>
            )}
          </div>
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando…" : "Enviar logo"}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={uploadLogo} />
            </label>
            {tema.logo_url && (
              <Button type="button" variant="ghost" size="sm" className="ml-2" onClick={() => setTema((t) => ({ ...t, logo_url: undefined }))}>
                Remover
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Cores</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cor primária">
            <div className="flex items-center gap-2">
              <input type="color" value={primary} onChange={(e) => setTema((t) => ({ ...t, primary_color: e.target.value }))} className="h-10 w-14 cursor-pointer rounded border border-border" />
              <Input value={primary} onChange={(e) => setTema((t) => ({ ...t, primary_color: e.target.value }))} maxLength={9} />
            </div>
          </Field>
          <Field label="Cor de destaque">
            <div className="flex items-center gap-2">
              <input type="color" value={accent} onChange={(e) => setTema((t) => ({ ...t, accent_color: e.target.value }))} className="h-10 w-14 cursor-pointer rounded border border-border" />
              <Input value={accent} onChange={(e) => setTema((t) => ({ ...t, accent_color: e.target.value }))} maxLength={9} />
            </div>
          </Field>
        </div>
        <div className="mt-4 rounded-lg border border-border p-4" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
          <div className="text-sm font-medium text-white">Pré-visualização do cabeçalho público</div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-base font-semibold">Domínio próprio</h2>
        <p className="mb-4 text-xs text-muted-foreground">Aponte um CNAME para <code className="rounded bg-muted px-1 py-0.5">app.lovableimob.com</code> e confirme abaixo.</p>
        <Field label="Seu domínio">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="site.minhaimobiliaria.com.br" maxLength={255} />
          </div>
        </Field>
        {dominio && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span>Aguardando verificação DNS. Após apontar o CNAME, salve para iniciar a validação.</span>
          </div>
        )}
        {!dominio && tenant.slug && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>URL ativa: <span className="font-mono">{tenant.slug}.lovableimob.com</span></span>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}