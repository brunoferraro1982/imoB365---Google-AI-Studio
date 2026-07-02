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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ColorPickerField } from "@/components/ui/color-picker-field";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/site/assistente")({
  component: SiteWizard,
});

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "boasvindas", label: "Boas-vindas", icon: PartyPopper },
  { id: "logo", label: "Logo", icon: Upload },
  { id: "cores", label: "Cores", icon: Palette },
  { id: "titulo", label: "Título", icon: Type },
  { id: "sobre", label: "Sobre você", icon: BookText },
  { id: "contato", label: "Contato", icon: Phone },
  { id: "paginas", label: "Páginas", icon: FileStack },
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

function SiteWizard() {
  const { tenantId, profile, user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hasTechnical, setHasTechnical] = useState<boolean | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: cfg }] = await Promise.all([
        supabase.from("tenants").select("slug,nome,tema").eq("id", tenantId).maybeSingle(),
        supabase.from("tenant_site_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
      ]);
      setTenantSlug(t?.slug ?? "");
      setLogoUrl((t?.tema as { logo_url?: string } | null)?.logo_url ?? "");

      // Coleta o essencial já respondido no onboarding, sem pedir de novo.
      const prefillNome = t?.nome || profile?.imobiliaria_nome || profile?.nome || "";

      if (cfg) {
        setForm({ ...EMPTY_FORM, ...cfg, hero_titulo: cfg.hero_titulo || prefillNome });
        setHasTechnical(
          Boolean(
            cfg.ga4_id || cfg.gtm_id || cfg.google_ads_id || cfg.fb_pixel_id || cfg.hotjar_id,
          ),
        );
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

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
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
    setLogoUrl(pub.publicUrl);
    setUploadingLogo(false);
    toast.success("Logo enviada");
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
    };

    const [{ error: siteErr }, { data: tenantRow }] = await Promise.all([
      supabase.from("tenant_site_settings").upsert(payload, { onConflict: "tenant_id" }),
      supabase.from("tenants").select("tema").eq("id", tenantId).maybeSingle(),
    ]);

    if (siteErr) {
      setSaving(false);
      return toast.error(siteErr.message);
    }

    if (logoUrl) {
      const tema = { ...((tenantRow?.tema as object) ?? {}), logo_url: logoUrl };
      await supabase.from("tenants").update({ tema }).eq("id", tenantId);
    }

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

    setSaving(false);
    toast.success(publicar ? "Site publicado com sucesso!" : "Rascunho salvo");
    navigate({ to: "/app/site" });
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const current = STEPS[step];

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
                title={s.label}
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
        <h2 className="mb-6 text-xl font-bold">{current.label}</h2>

        {step === 0 && (
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

        {step === 1 && (
          <div>
            <p className="mb-4 text-xs text-muted-foreground">
              Sua marca no topo do site. Pode pular esta etapa e adicionar depois.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="max-h-20 max-w-36 object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">Sem logo</span>
                )}
              </div>
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
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-4 text-xs text-muted-foreground">
              A cor principal do seu site — usada em botões e destaques. Clique numa amostra ou
              escolha a sua.
            </p>
            <ColorPickerField value={form.cor_destaque} onChange={(v) => set("cor_destaque", v)} />
          </div>
        )}

        {step === 3 && (
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
          </div>
        )}

        {step === 4 && (
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

        {step === 5 && (
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

        {step === 6 && (
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

        {step === 7 && (
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
