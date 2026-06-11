import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Plus, Trash2, Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { slugify } from "@/lib/format";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/site/")({
  component: SitePage,
});

type Settings = {
  tenant_id: string;
  publicado: boolean;
  hero_titulo: string | null;
  hero_subtitulo: string | null;
  hero_cta_label: string | null;
  sobre_html: string | null;
  contato_telefone: string | null;
  contato_whatsapp: string | null;
  contato_email: string | null;
  endereco: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  cor_destaque: string | null;
  meta_description: string | null;
  ga4_id: string | null;
  gtm_id: string | null;
  fb_pixel_id: string | null;
  google_ads_id: string | null;
  hotjar_id: string | null;
  head_custom_html: string | null;
};

type Page = {
  id: string;
  slug: string;
  titulo: string;
  conteudo_html: string;
  ordem: number;
  publicada: boolean;
  updated_at: string;
};

const EMPTY: Settings = {
  tenant_id: "",
  publicado: false,
  hero_titulo: "",
  hero_subtitulo: "",
  hero_cta_label: "Ver imóveis",
  sobre_html: "",
  contato_telefone: "",
  contato_whatsapp: "",
  contato_email: "",
  endereco: "",
  instagram_url: "",
  facebook_url: "",
  youtube_url: "",
  linkedin_url: "",
  cor_destaque: "",
  meta_description: "",
  ga4_id: "",
  gtm_id: "",
  fb_pixel_id: "",
  google_ads_id: "",
  hotjar_id: "",
  head_custom_html: "",
};

function SitePage() {
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [tenantNome, setTenantNome] = useState<string>("");
  const [s, setS] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [editing, setEditing] = useState<Page | null>(null);
  const [savingPage, setSavingPage] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: cfg }, { data: pg }] = await Promise.all([
        supabase.from("tenants").select("slug,nome").eq("id", tenantId).maybeSingle(),
        supabase.from("tenant_site_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
        supabase
          .from("tenant_pages")
          .select("id,slug,titulo,conteudo_html,ordem,publicada,updated_at")
          .eq("tenant_id", tenantId)
          .order("ordem"),
      ]);
      setTenantSlug(t?.slug ?? "");
      setTenantNome(t?.nome ?? "");
      if (cfg) setS({ ...EMPTY, ...cfg });
      else setS({ ...EMPTY, tenant_id: tenantId });
      setPages((pg ?? []) as Page[]);
      setLoading(false);
    })();
  }, [tenantId]);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((p) => ({ ...p, [k]: v }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    const payload = { ...s, tenant_id: tenantId };
    const { error } = await supabase
      .from("tenant_site_settings")
      .upsert(payload, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Site atualizado");
  }

  function novaPagina() {
    setEditing({
      id: "",
      slug: "",
      titulo: "",
      conteudo_html: "",
      ordem: pages.length,
      publicada: true,
      updated_at: "",
    });
  }

  async function savePage(e: FormEvent) {
    e.preventDefault();
    if (!editing || !tenantId) return;
    const slug = editing.slug.trim() || slugify(editing.titulo);
    if (!slug || editing.titulo.trim().length < 2) return toast.error("Informe título e slug");
    setSavingPage(true);
    if (editing.id) {
      const { error } = await supabase
        .from("tenant_pages")
        .update({
          slug,
          titulo: editing.titulo.trim(),
          conteudo_html: editing.conteudo_html,
          ordem: editing.ordem,
          publicada: editing.publicada,
        })
        .eq("id", editing.id);
      setSavingPage(false);
      if (error) return toast.error(error.message);
      toast.success("Página atualizada");
    } else {
      const { error } = await supabase.from("tenant_pages").insert({
        tenant_id: tenantId,
        slug,
        titulo: editing.titulo.trim(),
        conteudo_html: editing.conteudo_html,
        ordem: editing.ordem,
        publicada: editing.publicada,
      });
      setSavingPage(false);
      if (error) return toast.error(error.message);
      toast.success("Página criada");
    }
    setEditing(null);
    const { data: pg } = await supabase
      .from("tenant_pages")
      .select("id,slug,titulo,conteudo_html,ordem,publicada,updated_at")
      .eq("tenant_id", tenantId)
      .order("ordem");
    setPages((pg ?? []) as Page[]);
  }

  async function removePage(id: string) {
    if (!(await confirmDialog("Excluir esta página?"))) return;
    const { error } = await supabase.from("tenant_pages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPages((p) => p.filter((x) => x.id !== id));
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const siteUrl = tenantSlug ? `/site/${tenantSlug}` : "";

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site público</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure o site institucional de {tenantNome || "sua imobiliária"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s.publicado && siteUrl && (
            <a href={siteUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" /> Ver site
              </Button>
            </a>
          )}
          <Badge variant={s.publicado ? "default" : "secondary"}>
            {s.publicado ? "Publicado" : "Rascunho"}
          </Badge>
        </div>
      </header>

      <form onSubmit={save} className="mb-10 max-w-4xl space-y-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Publicação</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={s.publicado}
                onChange={(e) => set("publicado", e.target.checked)}
              />
              Site publicado em{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{siteUrl || "—"}</code>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cor de destaque (hex)">
              <Input
                placeholder="#3B82F6"
                value={s.cor_destaque ?? ""}
                onChange={(e) => set("cor_destaque", e.target.value)}
                maxLength={20}
              />
            </Field>
            <Field label="Meta description (SEO)">
              <Input
                value={s.meta_description ?? ""}
                onChange={(e) => set("meta_description", e.target.value)}
                maxLength={160}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">Hero (topo da home)</h2>
          <div className="grid gap-4">
            <Field label="Título">
              <Input
                value={s.hero_titulo ?? ""}
                onChange={(e) => set("hero_titulo", e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="Subtítulo">
              <Textarea
                rows={2}
                value={s.hero_subtitulo ?? ""}
                onChange={(e) => set("hero_subtitulo", e.target.value)}
                maxLength={300}
              />
            </Field>
            <Field label="Texto do botão">
              <Input
                value={s.hero_cta_label ?? ""}
                onChange={(e) => set("hero_cta_label", e.target.value)}
                maxLength={40}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">Sobre nós</h2>
          <Textarea
            rows={6}
            value={s.sobre_html ?? ""}
            onChange={(e) => set("sobre_html", e.target.value)}
            maxLength={5000}
            placeholder="HTML simples — <p>, <h2>, <ul>…"
            className="font-mono text-xs"
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">Contato</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Telefone">
              <Input
                value={s.contato_telefone ?? ""}
                onChange={(e) => set("contato_telefone", e.target.value)}
                maxLength={40}
              />
            </Field>
            <Field label="WhatsApp">
              <Input
                value={s.contato_whatsapp ?? ""}
                onChange={(e) => set("contato_whatsapp", e.target.value)}
                maxLength={40}
                placeholder="ex: 5511999998888"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={s.contato_email ?? ""}
                onChange={(e) => set("contato_email", e.target.value)}
                maxLength={255}
              />
            </Field>
            <Field label="Endereço">
              <Input
                value={s.endereco ?? ""}
                onChange={(e) => set("endereco", e.target.value)}
                maxLength={300}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">Redes sociais</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Instagram">
              <Input
                value={s.instagram_url ?? ""}
                onChange={(e) => set("instagram_url", e.target.value)}
                maxLength={255}
                placeholder="https://instagram.com/…"
              />
            </Field>
            <Field label="Facebook">
              <Input
                value={s.facebook_url ?? ""}
                onChange={(e) => set("facebook_url", e.target.value)}
                maxLength={255}
              />
            </Field>
            <Field label="YouTube">
              <Input
                value={s.youtube_url ?? ""}
                onChange={(e) => set("youtube_url", e.target.value)}
                maxLength={255}
              />
            </Field>
            <Field label="LinkedIn">
              <Input
                value={s.linkedin_url ?? ""}
                onChange={(e) => set("linkedin_url", e.target.value)}
                maxLength={255}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-base font-semibold">Tracking e analytics</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Códigos injetados no &lt;head&gt; das páginas públicas do seu site e dos imóveis.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Google Analytics 4 (G-XXXX)">
              <Input
                value={s.ga4_id ?? ""}
                onChange={(e) => set("ga4_id", e.target.value)}
                maxLength={40}
                placeholder="G-XXXXXXXXXX"
              />
            </Field>
            <Field label="Google Tag Manager (GTM-XXXX)">
              <Input
                value={s.gtm_id ?? ""}
                onChange={(e) => set("gtm_id", e.target.value)}
                maxLength={40}
                placeholder="GTM-XXXXXXX"
              />
            </Field>
            <Field label="Google Ads (AW-XXXX)">
              <Input
                value={s.google_ads_id ?? ""}
                onChange={(e) => set("google_ads_id", e.target.value)}
                maxLength={40}
                placeholder="AW-XXXXXXXXX"
              />
            </Field>
            <Field label="Meta Pixel (Facebook)">
              <Input
                value={s.fb_pixel_id ?? ""}
                onChange={(e) => set("fb_pixel_id", e.target.value)}
                maxLength={40}
                placeholder="1234567890"
              />
            </Field>
            <Field label="Hotjar ID">
              <Input
                value={s.hotjar_id ?? ""}
                onChange={(e) => set("hotjar_id", e.target.value)}
                maxLength={40}
                placeholder="1234567"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="HTML adicional no <head> (avançado)">
              <Textarea
                rows={4}
                className="font-mono text-xs"
                value={s.head_custom_html ?? ""}
                onChange={(e) => set("head_custom_html", e.target.value)}
                maxLength={5000}
                placeholder="<!-- scripts ou meta tags adicionais -->"
              />
            </Field>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar configurações"}
          </Button>
        </div>
      </form>

      <section className="max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Páginas customizadas</h2>
          {!editing && (
            <Button size="sm" onClick={novaPagina}>
              <Plus className="mr-2 h-4 w-4" /> Nova página
            </Button>
          )}
        </div>

        {editing ? (
          <form
            onSubmit={savePage}
            className="space-y-4 rounded-xl border border-border bg-card p-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Título">
                <Input
                  value={editing.titulo}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      titulo: e.target.value,
                      slug: editing.slug || slugify(e.target.value),
                    })
                  }
                  maxLength={120}
                />
              </Field>
              <Field label="Slug (URL)">
                <Input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                  maxLength={80}
                />
              </Field>
            </div>
            <Field label="Conteúdo (HTML)">
              <Textarea
                rows={14}
                value={editing.conteudo_html}
                onChange={(e) => setEditing({ ...editing, conteudo_html: e.target.value })}
                className="font-mono text-xs"
              />
            </Field>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.publicada}
                  onChange={(e) => setEditing({ ...editing, publicada: e.target.checked })}
                />
                Publicada
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingPage}>
                  {savingPage ? "Salvando…" : "Salvar página"}
                </Button>
              </div>
            </div>
          </form>
        ) : pages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Globe2 className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma página customizada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {pages.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.titulo}</span>
                    {!p.publicada && <Badge variant="outline">Rascunho</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    /site/{tenantSlug}/p/{p.slug}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removePage(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <ConfirmDialog />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
