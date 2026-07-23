import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  Palette,
  Type,
  BookText,
  Phone,
  FileStack,
  Code2,
  PartyPopper,
  Sparkles,
  LayoutTemplate,
  LayoutGrid,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ColorPickerField } from "@/components/ui/color-picker-field";
import { SectionOrderEditor, type SectionItem } from "@/components/site/SectionOrderEditor";
import {
  SECTION_LABELS,
  DEFAULT_SECOES,
  LAYOUT_INFO,
  LAYOUT_SUGGESTED_SECOES,
  ZONA_LABELS,
  secoesEqual,
  type SectionDbItem,
  type LayoutKey,
  type Zona,
} from "@/lib/siteSections";
import { slugify } from "@/lib/format";
import { uploadTenantBrandingImage } from "@/lib/tenantBranding";
import { CityChipsInput } from "@/components/CityChipsInput";
import { toast } from "sonner";

export const Route = createFileRoute("/app/site/assistente")({
  component: SiteWizard,
});

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "boasvindas", label: "Boas-vindas", icon: PartyPopper },
  { id: "layout", label: "Estilo do site", icon: LayoutTemplate },
  { id: "logo", label: "Logo", icon: Upload },
  { id: "cores", label: "Cores", icon: Palette },
  { id: "titulo", label: "Título", icon: Type },
  { id: "sobre", label: "Sobre você", icon: BookText },
  { id: "contato", label: "Contato", icon: Phone },
  { id: "paginas", label: "Páginas", icon: FileStack },
  { id: "secoes", label: "Seções", icon: LayoutGrid },
  { id: "tecnico", label: "SEO avançado", icon: Code2 },
] as const;

const PAGE_SUGESTOES = [
  { titulo: "Nossa Equipe", conteudo: "<p>Apresente aqui os corretores e a equipe.</p>" },
  {
    titulo: "Perguntas Frequentes",
    conteudo: "<h2>Dúvidas comuns</h2><p>Liste aqui as perguntas mais frequentes dos clientes.</p>",
  },
  {
    titulo: "Depoimentos de Clientes",
    conteudo: "<p>Compartilhe experiências de clientes satisfeitos.</p>",
  },
  {
    titulo: "Trabalhe Conosco",
    conteudo: "<p>Informações para corretores que querem se juntar à equipe.</p>",
  },
];

type FormData = {
  hero_titulo: string;
  hero_subtitulo: string;
  hero_cta_label: string;
  sobre_html: string;
  contato_telefone: string;
  contato_whatsapp: string;
  contato_email: string;
  endereco: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
  linkedin_url: string;
  cor_destaque: string;
  meta_description: string;
  ga4_id: string;
  gtm_id: string;
  google_ads_id: string;
  fb_pixel_id: string;
  hotjar_id: string;
};

const EMPTY_FORM: FormData = {
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
  cor_destaque: "#F2762E",
  meta_description: "",
  ga4_id: "",
  gtm_id: "",
  google_ads_id: "",
  fb_pixel_id: "",
  hotjar_id: "",
};

// tenant_site_settings tem várias colunas nullable no banco; sanitiza para
// nunca deixar um `null` vazar para o estado tipado como string (causava
// "Cannot read properties of null (reading 'trim')" em finish() quando o
// tenant tinha algum campo — ex.: endereço — nunca preenchido).
function sanitizeForm(raw: Record<string, unknown>): FormData {
  const out = { ...EMPTY_FORM };
  (Object.keys(EMPTY_FORM) as (keyof FormData)[]).forEach((k) => {
    const v = raw[k];
    if (typeof v === "string") out[k] = v;
  });
  return out;
}

function SiteWizard() {
  const { tenantId, profile, user } = useAuth();
  const navigate = useNavigate();
  const isCorretor = profile?.tipo_usuario === "corretor";

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [cidadesAtuacao, setCidadesAtuacao] = useState<string[]>([]);
  const [regiaoAtuacao, setRegiaoAtuacao] = useState("");
  const [hasTechnical, setHasTechnical] = useState<boolean | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<LayoutKey>("classico");
  const [secoes, setSecoes] = useState<SectionDbItem[]>(DEFAULT_SECOES);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: cfg }] = await Promise.all([
        supabase
          .from("tenants")
          .select("slug,nome,tema,cidades_atuacao,regiao_atuacao")
          .eq("id", tenantId)
          .maybeSingle(),
        supabase.from("tenant_site_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
      ]);
      setTenantSlug(t?.slug ?? "");
      setLogoUrl((t?.tema as { logo_url?: string } | null)?.logo_url ?? "");
      setCidadesAtuacao(t?.cidades_atuacao ?? []);
      setRegiaoAtuacao(t?.regiao_atuacao ?? "");

      // Coleta o essencial já respondido no onboarding, sem pedir de novo.
      const prefillNome = t?.nome || profile?.imobiliaria_nome || profile?.nome || "";

      if (cfg) {
        const sanitized = sanitizeForm(cfg as unknown as Record<string, unknown>);
        setForm({ ...sanitized, hero_titulo: sanitized.hero_titulo || prefillNome });
        setHasTechnical(
          Boolean(
            cfg.ga4_id || cfg.gtm_id || cfg.google_ads_id || cfg.fb_pixel_id || cfg.hotjar_id,
          ),
        );
        setLayout((cfg.layout as LayoutKey) || "classico");
        setSecoes((cfg.secoes as SectionDbItem[] | null) ?? DEFAULT_SECOES);
      } else {
        setForm((f) => ({
          ...f,
          hero_titulo: prefillNome,
          contato_email: user?.email || "",
        }));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function pickLayout(key: LayoutKey) {
    setLayout(key);
    // Só aplica a ordem sugerida do layout se o tenant ainda não customizou
    // as seções (evita sobrescrever uma escolha manual já feita).
    setSecoes((prev) => (secoesEqual(prev, DEFAULT_SECOES) ? LAYOUT_SUGGESTED_SECOES[key] : prev));
  }

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function uploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    setUploadingLogo(true);
    try {
      const url = await uploadTenantBrandingImage(tenantId, file);
      setLogoUrl(url);
      toast.success(isCorretor ? "Foto enviada" : "Logo enviada");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingLogo(false);
    }
  }

  function togglePage(titulo: string) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(titulo)) next.delete(titulo);
      else next.add(titulo);
      return next;
    });
  }

  async function finish(publicar: boolean) {
    if (!tenantId) return;
    setSaving(true);

    try {
      const payload = {
        tenant_id: tenantId,
        publicado: publicar,
        hero_titulo: form.hero_titulo.trim(),
        hero_subtitulo: form.hero_subtitulo.trim() || null,
        hero_cta_label: form.hero_cta_label.trim() || "Ver imóveis",
        sobre_html: form.sobre_html || null,
        contato_telefone: form.contato_telefone.trim() || null,
        contato_whatsapp: form.contato_whatsapp.trim() || null,
        contato_email: form.contato_email.trim() || null,
        endereco: form.endereco.trim() || null,
        instagram_url: form.instagram_url.trim() || null,
        facebook_url: form.facebook_url.trim() || null,
        youtube_url: form.youtube_url.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        cor_destaque: form.cor_destaque || null,
        meta_description: form.meta_description.trim() || null,
        ga4_id: hasTechnical ? form.ga4_id.trim() || null : null,
        gtm_id: hasTechnical ? form.gtm_id.trim() || null : null,
        google_ads_id: hasTechnical ? form.google_ads_id.trim() || null : null,
        fb_pixel_id: hasTechnical ? form.fb_pixel_id.trim() || null : null,
        hotjar_id: hasTechnical ? form.hotjar_id.trim() || null : null,
        layout,
        secoes,
      };

      const [{ error: siteErr }, { data: tenantRow }] = await Promise.all([
        supabase.from("tenant_site_settings").upsert(payload, { onConflict: "tenant_id" }),
        supabase.from("tenants").select("tema").eq("id", tenantId).maybeSingle(),
      ]);

      if (siteErr) {
        toast.error(siteErr.message);
        return;
      }

      await supabase
        .from("tenants")
        .update({
          cidades_atuacao: cidadesAtuacao.length ? cidadesAtuacao : null,
          regiao_atuacao: regiaoAtuacao.trim() || null,
          ...(logoUrl
            ? { tema: { ...((tenantRow?.tema as object) ?? {}), logo_url: logoUrl } }
            : {}),
        })
        .eq("id", tenantId);

      if (selectedPages.size > 0) {
        const rows = Array.from(selectedPages).map((titulo, i) => {
          const sug = PAGE_SUGESTOES.find((p) => p.titulo === titulo);
          return {
            tenant_id: tenantId,
            slug: slugify(titulo),
            titulo,
            conteudo_html: sug?.conteudo ?? "<p></p>",
            ordem: i,
            publicada: false,
          };
        });
        await supabase.from("tenant_pages").upsert(rows, { onConflict: "tenant_id,slug" });
      }

      toast.success(publicar ? "Site publicado com sucesso!" : "Rascunho salvo");
      navigate({ to: "/app/site" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado ao salvar o site.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const current = STEPS[step];
  // Etapa "logo" é a única com rótulo/conteúdo condicionado ao tipo de perfil.
  function stepLabel(s: { id: string; label: string }) {
    return s.id === "logo" ? (isCorretor ? "Foto" : "Logo") : s.label;
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link
        to="/app/site"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para configurações
      </Link>

      <div className="mb-8 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Vamos criar seu site</h1>
      </div>

      {/* ── Stepper ─────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <div key={s.id} className="flex items-center gap-1">
              <div
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "active" && "border-primary text-primary ring-2 ring-primary/20",
                  state === "todo" && "border-border text-muted-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={stepLabel(s)}
              >
                {state === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px w-4 shrink-0 sm:w-8 ${i < step ? "bg-primary" : "bg-border"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 md:p-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Etapa {step + 1} de {STEPS.length}
        </p>
        <h2 className="mb-6 text-xl font-bold">{stepLabel(current)}</h2>

        {current.id === "boasvindas" && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Em poucos passos você monta a página pública da sua imobiliária — sem precisar
              escrever código ou saber nada de design.
            </p>
            <p>
              Você pode voltar e mudar qualquer coisa depois, a qualquer momento, em{" "}
              <span className="font-medium text-foreground">Site → Site da imobiliária</span>.
            </p>
            <p>Vamos começar?</p>
          </div>
        )}

        {current.id === "layout" && (
          <div>
            <p className="mb-4 text-xs text-muted-foreground">
              Escolha o estilo do seu site — dá para trocar depois a qualquer momento, sem perder o
              que você já preencheu.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(LAYOUT_INFO) as LayoutKey[]).map((key) => {
                const info = LAYOUT_INFO[key];
                const selected = layout === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickLayout(key)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="mb-3 flex h-16 flex-col gap-1 overflow-hidden rounded-lg border border-border/60 bg-muted/30 p-1.5">
                      <div className="h-2.5 w-full rounded-sm bg-muted-foreground/30" />
                      <div className="h-1.5 w-2/3 rounded-sm bg-muted-foreground/20" />
                      <div className="mt-auto flex gap-1">
                        <div className="h-3 flex-1 rounded-sm bg-primary/30" />
                        <div className="h-3 flex-1 rounded-sm bg-primary/20" />
                        <div className="h-3 flex-1 rounded-sm bg-primary/20" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{info.label}</span>
                      {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{info.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {current.id === "logo" && (
          <div>
            <p className="mb-4 text-xs text-muted-foreground">
              {isCorretor
                ? "Sua foto, exibida no topo do site e na home do portal. Pode pular esta etapa e adicionar depois."
                : "Sua marca no topo do site. Pode pular esta etapa e adicionar depois."}
            </p>
            <div className="flex items-center gap-6">
              <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={isCorretor ? "Foto" : "Logo"}
                    className="max-h-20 max-w-36 object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {isCorretor ? "Sem foto" : "Sem logo"}
                  </span>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploadingLogo ? "Enviando…" : isCorretor ? "Enviar foto" : "Enviar logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={uploadLogo}
                />
              </label>
            </div>
          </div>
        )}

        {current.id === "cores" && (
          <div>
            <p className="mb-4 text-xs text-muted-foreground">
              A cor principal do seu site — usada em botões e destaques. Clique numa amostra ou
              escolha a sua.
            </p>
            <ColorPickerField value={form.cor_destaque} onChange={(v) => set("cor_destaque", v)} />
          </div>
        )}

        {current.id === "titulo" && (
          <div className="space-y-4">
            <Field label="Nome da imobiliária / seu nome, como corretor">
              <Input
                value={form.hero_titulo}
                onChange={(e) => set("hero_titulo", e.target.value)}
                maxLength={120}
                placeholder="Ex: Imobiliária Litoral Sul"
              />
            </Field>
            <Field label="Frase de efeito (aparece embaixo do nome)">
              <Textarea
                rows={2}
                value={form.hero_subtitulo}
                onChange={(e) => set("hero_subtitulo", e.target.value)}
                maxLength={300}
                placeholder="Ex: Encontre o imóvel dos seus sonhos com quem entende do litoral."
              />
            </Field>
            <Field label="Texto do botão principal">
              <Input
                value={form.hero_cta_label}
                onChange={(e) => set("hero_cta_label", e.target.value)}
                maxLength={40}
              />
            </Field>
            <Field label="Cidades de atuação" hint="Até 3 cidades onde você atende.">
              <CityChipsInput
                value={cidadesAtuacao}
                onChange={setCidadesAtuacao}
                placeholder="Ex: Santos"
              />
            </Field>
            <Field label="Região de atuação">
              <Input
                value={regiaoAtuacao}
                onChange={(e) => setRegiaoAtuacao(e.target.value)}
                maxLength={120}
                placeholder="Ex: Litoral Sul de SP"
              />
            </Field>
          </div>
        )}

        {current.id === "sobre" && (
          <div>
            <p className="mb-4 text-xs text-muted-foreground">
              Conte sua história — há quanto tempo atua, o que te diferencia, sua região de atuação.
              Isso passa confiança para quem visita o site.
            </p>
            <RichTextEditor
              value={form.sobre_html}
              onChange={(html) => set("sobre_html", html)}
              placeholder="Ex: Há mais de 10 anos ajudando famílias a encontrar o imóvel ideal no litoral sul de SP…"
            />
          </div>
        )}

        {current.id === "contato" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Telefone">
                <Input
                  value={form.contato_telefone}
                  onChange={(e) => set("contato_telefone", e.target.value)}
                  maxLength={40}
                />
              </Field>
              <Field label="WhatsApp" hint="Só dígitos, com DDI + DDD. Ex: 5511999998888">
                <Input
                  value={form.contato_whatsapp}
                  onChange={(e) => set("contato_whatsapp", e.target.value.replace(/[^\d]/g, ""))}
                  maxLength={20}
                  inputMode="numeric"
                  placeholder="5511999998888"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.contato_email}
                  onChange={(e) => set("contato_email", e.target.value)}
                  maxLength={255}
                />
              </Field>
              <Field label="Endereço">
                <Input
                  value={form.endereco}
                  onChange={(e) => set("endereco", e.target.value)}
                  maxLength={300}
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Instagram">
                <Input
                  value={form.instagram_url}
                  onChange={(e) => set("instagram_url", e.target.value)}
                  maxLength={255}
                  placeholder="https://instagram.com/…"
                />
              </Field>
              <Field label="Facebook">
                <Input
                  value={form.facebook_url}
                  onChange={(e) => set("facebook_url", e.target.value)}
                  maxLength={255}
                />
              </Field>
              <Field label="YouTube">
                <Input
                  value={form.youtube_url}
                  onChange={(e) => set("youtube_url", e.target.value)}
                  maxLength={255}
                />
              </Field>
              <Field label="LinkedIn">
                <Input
                  value={form.linkedin_url}
                  onChange={(e) => set("linkedin_url", e.target.value)}
                  maxLength={255}
                />
              </Field>
            </div>
          </div>
        )}

        {current.id === "paginas" && (
          <div>
            <p className="mb-4 text-xs text-muted-foreground">
              Quer já deixar mais páginas prontas para preencher depois? Marque as que fizerem
              sentido — pode adicionar outras a qualquer momento.
            </p>
            <div className="space-y-2">
              {PAGE_SUGESTOES.map((p) => (
                <label
                  key={p.titulo}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedPages.has(p.titulo)}
                    onChange={() => togglePage(p.titulo)}
                  />
                  {p.titulo}
                </label>
              ))}
            </div>
          </div>
        )}

        {current.id === "secoes" && (
          <div>
            <p className="mb-4 text-xs text-muted-foreground">
              {layout === "amplo"
                ? "Escolha em qual área (menu lateral, conteúdo central ou coluna de destaque) cada seção aparece, e a ordem dentro de cada área. O Hero (topo) é sempre fixo."
                : "Escolha a ordem e quais seções aparecem na home do seu site. O Hero (topo) é sempre fixo."}
            </p>
            <SectionOrderEditor
              pinnedLabel="Hero"
              zonas={
                layout === "amplo"
                  ? (Object.keys(ZONA_LABELS) as Zona[]).map((key) => ({
                      key,
                      label: ZONA_LABELS[key],
                    }))
                  : undefined
              }
              items={secoes
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map(
                  (d): SectionItem => ({
                    key: d.key,
                    label: SECTION_LABELS[d.key] ?? d.key,
                    visivel: d.visivel,
                    zona: d.zona,
                  }),
                )}
              onChange={(next) =>
                setSecoes(
                  next.map((item, i) => ({
                    key: item.key as SectionDbItem["key"],
                    visivel: item.visivel,
                    ordem: i,
                    zona: item.zona,
                  })),
                )
              }
            />
          </div>
        )}

        {current.id === "tecnico" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Você (ou alguém da sua equipe) já usa ferramentas de marketing digital como Google
              Analytics, Google Ads ou Facebook Ads?
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={hasTechnical === false ? "default" : "outline"}
                onClick={() => setHasTechnical(false)}
              >
                Não, pode pular esta parte
              </Button>
              <Button
                type="button"
                variant={hasTechnical === true ? "default" : "outline"}
                onClick={() => setHasTechnical(true)}
              >
                Sim, quero configurar
              </Button>
            </div>

            {hasTechnical === false && (
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Sem problema — seu site já sai com SEO básico configurado (título e descrição para o
                Google). Essas ferramentas avançadas continuam disponíveis depois em{" "}
                <span className="font-medium text-foreground">
                  Site → Site da imobiliária → Configurações avançadas
                </span>
                , se um dia precisar.
              </p>
            )}

            {hasTechnical === true && (
              <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                <Field label="Google Analytics 4" hint="Pegue o código em analytics.google.com.">
                  <Input
                    value={form.ga4_id}
                    onChange={(e) => set("ga4_id", e.target.value)}
                    maxLength={40}
                    placeholder="G-XXXXXXXXXX"
                  />
                </Field>
                <Field label="Google Tag Manager">
                  <Input
                    value={form.gtm_id}
                    onChange={(e) => set("gtm_id", e.target.value)}
                    maxLength={40}
                    placeholder="GTM-XXXXXXX"
                  />
                </Field>
                <Field label="Google Ads">
                  <Input
                    value={form.google_ads_id}
                    onChange={(e) => set("google_ads_id", e.target.value)}
                    maxLength={40}
                    placeholder="AW-XXXXXXXXX"
                  />
                </Field>
                <Field label="Meta Pixel (Facebook/Instagram)">
                  <Input
                    value={form.fb_pixel_id}
                    onChange={(e) => set("fb_pixel_id", e.target.value)}
                    maxLength={40}
                    placeholder="1234567890"
                  />
                </Field>
              </div>
            )}

            <Field
              label="Frase de apresentação (aparece no Google)"
              hint="O resumo que aparece embaixo do título quando alguém te encontra numa busca."
            >
              <Input
                value={form.meta_description}
                onChange={(e) => set("meta_description", e.target.value)}
                maxLength={160}
                placeholder="Ex: Imóveis de alto padrão no litoral sul de SP, com atendimento personalizado."
              />
            </Field>
          </div>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={isFirst}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>

        {!isLast ? (
          <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Próximo <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => finish(false)}>
              Salvar como rascunho
            </Button>
            <Button type="button" disabled={saving} onClick={() => finish(true)}>
              {saving ? "Publicando…" : "Publicar meu site"}
            </Button>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Site: <span className="font-mono">/site/{tenantSlug || "…"}</span>
      </p>
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
