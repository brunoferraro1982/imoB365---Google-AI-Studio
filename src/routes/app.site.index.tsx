import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ExternalLink,
  Plus,
  Trash2,
  Globe2,
  ChevronDown,
  Settings2,
  Sparkles,
  ArrowRight,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ColorPickerField } from "@/components/ui/color-picker-field";
import { toast } from "sonner";
import { slugify } from "@/lib/format";
import { useConfirm } from "@/hooks/useConfirm";
import { SectionOrderEditor, type SectionItem } from "@/components/site/SectionOrderEditor";
import { SECTION_LABELS, DEFAULT_SECOES, type SectionDbItem } from "@/lib/siteSections";

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
  secoes: SectionDbItem[];
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

type Identidade = {
  nome: string;
  slug: string;
  cnpj: string;
  creci_juridico: string;
};

type Tema = {
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
};

const EMPTY_IDENTIDADE: Identidade = { nome: "", slug: "", cnpj: "", creci_juridico: "" };

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
  secoes: DEFAULT_SECOES,
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

  const [identidade, setIdentidade] = useState<Identidade>(EMPTY_IDENTIDADE);
  const [planoSlug, setPlanoSlug] = useState<string | null>(null);
  const [tenantStatus, setTenantStatus] = useState<string | null>(null);
  const [savingIdentidade, setSavingIdentidade] = useState(false);

  const [tema, setTema] = useState<Tema>({});
  const [savingMarca, setSavingMarca] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: cfg }, { data: pg }] = await Promise.all([
        supabase
          .from("tenants")
          .select("slug,nome,cnpj,creci_juridico,tema,plano_slug,status")
          .eq("id", tenantId)
          .maybeSingle(),
        supabase.from("tenant_site_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
        supabase
          .from("tenant_pages")
          .select("id,slug,titulo,conteudo_html,ordem,publicada,updated_at")
          .eq("tenant_id", tenantId)
          .order("ordem"),
      ]);
      setTenantSlug(t?.slug ?? "");
      setTenantNome(t?.nome ?? "");
      setIdentidade({
        nome: t?.nome ?? "",
        slug: t?.slug ?? "",
        cnpj: t?.cnpj ?? "",
        creci_juridico: t?.creci_juridico ?? "",
      });
      setPlanoSlug(t?.plano_slug ?? null);
      setTenantStatus(t?.status ?? null);
      setTema((t?.tema as Tema) ?? {});
      if (cfg)
        setS({
          ...EMPTY,
          ...cfg,
          secoes: (cfg.secoes as SectionDbItem[] | null) ?? DEFAULT_SECOES,
        });
      else setS({ ...EMPTY, tenant_id: tenantId });
      setPages((pg ?? []) as Page[]);
      setLoading(false);
    })();
  }, [tenantId]);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((p) => ({ ...p, [k]: v }));
  }

  async function saveIdentidade(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSavingIdentidade(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        nome: identidade.nome,
        slug: identidade.slug,
        cnpj: identidade.cnpj,
        creci_juridico: identidade.creci_juridico,
      })
      .eq("id", tenantId);
    setSavingIdentidade(false);
    if (error) return toast.error(error.message);
    setTenantSlug(identidade.slug);
    setTenantNome(identidade.nome);
    toast.success("Identidade atualizada");
  }

  async function uploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo deve ter no máximo 2MB");
    setUploadingLogo(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${tenantId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("tenant-branding")
      .upload(path, file, { upsert: true });
    if (error) {
      setUploadingLogo(false);
      return toast.error(error.message);
    }
    const { data: pub } = supabase.storage.from("tenant-branding").getPublicUrl(path);
    setTema((t) => ({ ...t, logo_url: pub.publicUrl }));
    setUploadingLogo(false);
    toast.success("Logo enviada");
  }

  async function saveMarca(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSavingMarca(true);
    const { error } = await supabase
      .from("tenants")
      .update({ tema: tema as any })
      .eq("id", tenantId);
    setSavingMarca(false);
    if (error) return toast.error(error.message);
    toast.success("Marca atualizada");
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
          <Link to="/app/site/assistente">
            <Button>
              <Sparkles className="mr-2 h-4 w-4" /> Vamos criar seu site aqui
            </Button>
          </Link>
        </div>
      </header>

      {!s.hero_titulo && !s.sobre_html && (
        <div className="mb-8 flex max-w-4xl flex-col items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Seu site ainda não foi configurado</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Em poucos minutos, respondendo perguntas simples, você deixa sua página pública
                pronta — sem precisar saber nada de design ou tecnologia.
              </p>
            </div>
          </div>
          <Link to="/app/site/assistente" className="shrink-0">
            <Button size="lg">
              Vamos criar seu site aqui <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      <form onSubmit={saveIdentidade} className="mb-6 max-w-4xl space-y-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">Identidade</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome fantasia *">
              <Input
                required
                value={identidade.nome}
                onChange={(e) => setIdentidade((d) => ({ ...d, nome: e.target.value }))}
                maxLength={200}
              />
            </Field>
            <Field label="Slug (URL pública)">
              <Input
                value={identidade.slug}
                onChange={(e) => setIdentidade((d) => ({ ...d, slug: e.target.value }))}
                maxLength={80}
              />
            </Field>
            <Field label="CNPJ">
              <Input
                value={identidade.cnpj}
                onChange={(e) => setIdentidade((d) => ({ ...d, cnpj: e.target.value }))}
                maxLength={20}
                placeholder="00.000.000/0000-00"
              />
            </Field>
            <Field label="CRECI Jurídico (CRECI-J)">
              <Input
                value={identidade.creci_juridico}
                onChange={(e) => setIdentidade((d) => ({ ...d, creci_juridico: e.target.value }))}
                maxLength={40}
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <div>
              <div>
                Plano atual: <span className="font-medium text-foreground">{planoSlug ?? "—"}</span>
              </div>
              <div>
                Status: <span className="font-medium text-foreground">{tenantStatus ?? "—"}</span>
              </div>
            </div>
            <span>Para mudar plano ou status, fale com o super-admin.</span>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={savingIdentidade}>
              {savingIdentidade ? "Salvando…" : "Salvar identidade"}
            </Button>
          </div>
        </section>
      </form>

      <form onSubmit={saveMarca} className="mb-6 max-w-4xl space-y-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-base font-semibold">Marca</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Logotipo e cores da sua marca. Aparecem no site público e em e-mails.
          </p>
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
                {uploadingLogo ? "Enviando…" : "Enviar logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={uploadLogo}
                />
              </label>
              {tema.logo_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={() => setTema((t) => ({ ...t, logo_url: undefined }))}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Cor primária da marca">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tema.primary_color || "#0f172a"}
                  onChange={(e) => setTema((t) => ({ ...t, primary_color: e.target.value }))}
                  className="h-10 w-14 cursor-pointer rounded border border-border"
                />
                <Input
                  value={tema.primary_color || "#0f172a"}
                  onChange={(e) => setTema((t) => ({ ...t, primary_color: e.target.value }))}
                  maxLength={9}
                />
              </div>
            </Field>
            <Field label="Cor de destaque da marca">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tema.accent_color || "#3b82f6"}
                  onChange={(e) => setTema((t) => ({ ...t, accent_color: e.target.value }))}
                  className="h-10 w-14 cursor-pointer rounded border border-border"
                />
                <Input
                  value={tema.accent_color || "#3b82f6"}
                  onChange={(e) => setTema((t) => ({ ...t, accent_color: e.target.value }))}
                  maxLength={9}
                />
              </div>
            </Field>
          </div>
          <div
            className="mt-4 rounded-lg border border-border p-4"
            style={{
              background: `linear-gradient(135deg, ${tema.primary_color || "#0f172a"}, ${tema.accent_color || "#3b82f6"})`,
            }}
          >
            <div className="text-sm font-medium text-white">
              Pré-visualização do cabeçalho público
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={savingMarca}>
              {savingMarca ? "Salvando…" : "Salvar marca"}
            </Button>
          </div>
        </section>
      </form>

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
            <Field label="Cor de destaque do seu site">
              <ColorPickerField
                value={s.cor_destaque ?? ""}
                onChange={(v) => set("cor_destaque", v)}
              />
            </Field>
            <Field
              label="Frase de apresentação (aparece no Google)"
              hint="O resumo que aparece embaixo do título quando alguém te encontra numa busca."
            >
              <Input
                value={s.meta_description ?? ""}
                onChange={(e) => set("meta_description", e.target.value)}
                maxLength={160}
                placeholder="Ex: Imóveis de alto padrão no litoral sul de SP, com atendimento personalizado."
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
          <h2 className="mb-1 text-base font-semibold">Sobre nós</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Conte a história da sua imobiliária/carreira. Aparece na home do seu site.
          </p>
          <RichTextEditor
            value={s.sobre_html ?? ""}
            onChange={(html) => set("sobre_html", html)}
            placeholder="Ex: Há mais de 10 anos ajudando famílias a encontrar o imóvel ideal no litoral sul de SP…"
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
            <Field
              label="WhatsApp"
              hint="DDI + DDD + número, só dígitos. Ex: Brasil (55) + São Paulo (11) + número."
            >
              <Input
                value={s.contato_whatsapp ?? ""}
                onChange={(e) => set("contato_whatsapp", e.target.value.replace(/[^\d]/g, ""))}
                maxLength={20}
                placeholder="5511999998888"
                inputMode="numeric"
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
          <h2 className="mb-1 text-base font-semibold">Seções da página inicial</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Escolha a ordem e quais seções aparecem na home do seu site. O Hero (topo) é sempre
            fixo.
          </p>
          <SectionOrderEditor
            pinnedLabel="Hero"
            items={s.secoes
              .slice()
              .sort((a, b) => a.ordem - b.ordem)
              .map(
                (d): SectionItem => ({
                  key: d.key,
                  label: SECTION_LABELS[d.key] ?? d.key,
                  visivel: d.visivel,
                }),
              )}
            onChange={(next) =>
              set(
                "secoes",
                next.map((item, i) => ({
                  key: item.key as SectionDbItem["key"],
                  visivel: item.visivel,
                  ordem: i,
                })),
              )
            }
          />
        </section>

        <Collapsible className="rounded-xl border border-border bg-card">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 p-6 text-left">
            <div className="flex items-center gap-2.5">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <h2 className="text-base font-semibold">Configurações avançadas (opcional)</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Só preencha se você (ou alguém da sua equipe de marketing) já usa ferramentas como
                  Google Analytics ou Facebook Ads. Não é necessário para o site funcionar.
                </p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 border-t border-border p-6 pt-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Google Analytics 4"
                hint="Mostra quantas pessoas visitam seu site. Pegue o código em analytics.google.com."
              >
                <Input
                  value={s.ga4_id ?? ""}
                  onChange={(e) => set("ga4_id", e.target.value)}
                  maxLength={40}
                  placeholder="G-XXXXXXXXXX"
                />
              </Field>
              <Field
                label="Google Tag Manager"
                hint="Gerenciador de tags do Google, usado por agências de marketing."
              >
                <Input
                  value={s.gtm_id ?? ""}
                  onChange={(e) => set("gtm_id", e.target.value)}
                  maxLength={40}
                  placeholder="GTM-XXXXXXX"
                />
              </Field>
              <Field label="Google Ads" hint="Necessário se você roda anúncios pagos no Google.">
                <Input
                  value={s.google_ads_id ?? ""}
                  onChange={(e) => set("google_ads_id", e.target.value)}
                  maxLength={40}
                  placeholder="AW-XXXXXXXXX"
                />
              </Field>
              <Field
                label="Meta Pixel (Facebook/Instagram)"
                hint="Necessário se você roda anúncios no Facebook ou Instagram."
              >
                <Input
                  value={s.fb_pixel_id ?? ""}
                  onChange={(e) => set("fb_pixel_id", e.target.value)}
                  maxLength={40}
                  placeholder="1234567890"
                />
              </Field>
              <Field label="Hotjar" hint="Ferramenta de mapa de calor/gravação de sessões.">
                <Input
                  value={s.hotjar_id ?? ""}
                  onChange={(e) => set("hotjar_id", e.target.value)}
                  maxLength={40}
                  placeholder="1234567"
                />
              </Field>
            </div>
            <Field
              label="Código HTML adicional (só para quem sabe programar)"
              hint="Use apenas se um desenvolvedor te passou um trecho de código específico para colar aqui."
            >
              <Textarea
                rows={4}
                className="font-mono text-xs"
                value={s.head_custom_html ?? ""}
                onChange={(e) => set("head_custom_html", e.target.value)}
                maxLength={5000}
                placeholder="<!-- scripts ou meta tags adicionais -->"
              />
            </Field>
          </CollapsibleContent>
        </Collapsible>

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
            <Field label="Conteúdo da página">
              <RichTextEditor
                value={editing.conteudo_html}
                onChange={(html) => setEditing({ ...editing, conteudo_html: html })}
                placeholder="Escreva o conteúdo desta página…"
                minHeight={320}
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}
