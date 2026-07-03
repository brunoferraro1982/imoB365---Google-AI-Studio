import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState, useMemo, type FormEvent } from "react";
import {
  Bed,
  Bath,
  Maximize2,
  MapPin,
  Building2,
  ShieldCheck,
  Sparkles,
  Send,
  Phone,
  Mail,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TenantSiteLayout, type SiteCtx } from "@/components/site/TenantSiteLayout";
import { SiteWidgetsLayout, useSiteWidgets } from "@/components/site/SiteWidgets";
import { TrackingPixels } from "@/components/site/TrackingPixels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatBRL, FINALIDADE_LABEL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/site/$slug")({
  component: TenantHome,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Imóveis` },
      { property: "og:title", content: `${params.slug} — Imóveis` },
      { property: "og:url", content: `/site/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `/site/${params.slug}` }],
  }),
});

function photoUrl(path: string) {
  return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
}

function TenantHome() {
  const { slug } = Route.useParams();
  const [ctx, setCtx] = useState<SiteCtx | null>(null);
  const [hero, setHero] = useState<any>({});
  const [sobre, setSobre] = useState<string>("");
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [fotosMap, setFotosMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id,slug,nome,tema")
        .eq("slug", slug)
        .maybeSingle();
      if (!tenant) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }
      const [{ data: cfg }, { data: pages }, { data: imv }, { count: blogCount }] =
        await Promise.all([
          supabase
            .from("tenant_site_settings")
            .select("*")
            .eq("tenant_id", tenant.id)
            .eq("publicado", true)
            .maybeSingle(),
          supabase
            .from("tenant_pages")
            .select("slug,titulo")
            .eq("tenant_id", tenant.id)
            .eq("publicada", true)
            .order("ordem"),
          supabase
            .from("imoveis")
            .select(
              "id,slug,titulo,tipo,finalidade,preco,quartos,banheiros,area_util,endereco_bairro,endereco_cidade,endereco_uf",
            )
            .eq("tenant_id", tenant.id)
            .eq("publicado", true)
            .eq("status", "ativo")
            .order("publicado_em", { ascending: false })
            .limit(12),
          supabase
            .from("blog_posts")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .eq("status", "publicado"),
        ]);
      if (!cfg) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }
      setCtx({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantNome: tenant.nome,
        logoUrl: (tenant.tema as { logo_url?: string } | null)?.logo_url,
        settings: cfg,
        pages: (pages ?? []) as any,
        hasBlog: (blogCount ?? 0) > 0,
      });
      setHero(cfg);
      setSobre(cfg.sobre_html ?? "");
      setImoveis(imv ?? []);
      if (imv && imv.length) {
        const { data: fotos } = await supabase
          .from("imovel_fotos")
          .select("imovel_id,storage_path,capa,ordem")
          .in(
            "imovel_id",
            imv.map((i) => i.id),
          )
          .order("capa", { ascending: false })
          .order("ordem");
        const map: Record<string, string> = {};
        (fotos ?? []).forEach((f) => {
          if (!map[f.imovel_id]) map[f.imovel_id] = photoUrl(f.storage_path);
        });
        setFotosMap(map);
      }
      setLoading(false);
    })();
  }, [slug]);

  const stats = useMemo(() => {
    const cidades = new Set(imoveis.map((i) => i.endereco_cidade).filter(Boolean));
    const tipos = new Set(imoveis.map((i) => i.tipo).filter(Boolean));
    return [
      imoveis.length > 0 && {
        icon: Building2,
        label: imoveis.length === 1 ? "imóvel disponível" : "imóveis disponíveis",
        value: String(imoveis.length),
      },
      cidades.size > 1 && { icon: MapPin, label: "cidades atendidas", value: String(cidades.size) },
      tipos.size > 1 && { icon: Sparkles, label: "tipos de imóvel", value: String(tipos.size) },
    ].filter(Boolean) as { icon: typeof Building2; label: string; value: string }[];
  }, [imoveis]);

  const { esquerda, direita } = useSiteWidgets(ctx?.tenantId);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  if (notFoundState || !ctx) return <NotPublished />;

  return (
    <TenantSiteLayout ctx={ctx}>
      <TrackingPixels pixels={ctx.settings as any} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,_var(--primary)_22%,_transparent),_transparent_65%)]" />
        <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Site oficial de {ctx.tenantNome}
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            {hero.hero_titulo || ctx.tenantNome}
          </h1>
          {hero.hero_subtitulo && (
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              {hero.hero_subtitulo}
            </p>
          )}
          <div className="mt-9">
            <a href="#imoveis">
              <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
                {hero.hero_cta_label || "Ver imóveis"}
              </Button>
            </a>
          </div>

          {stats.length > 0 && (
            <div className="mx-auto mt-16 flex max-w-2xl flex-wrap items-center justify-center gap-x-10 gap-y-6 border-t border-border/60 pt-10">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-bold leading-tight">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Imóveis ──────────────────────────────────────────── */}
      <section id="imoveis" className="mx-auto max-w-6xl px-6 py-20">
        <SiteWidgetsLayout ctx={ctx} esquerda={esquerda} direita={direita}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Imóveis em destaque</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {imoveis.length > 0
                  ? `${imoveis.length} ${imoveis.length === 1 ? "opção selecionada" : "opções selecionadas"} para você`
                  : "Em breve, novidades por aqui"}
              </p>
            </div>
          </div>
          {imoveis.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum imóvel publicado no momento.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {imoveis.map((i) => (
                <Link
                  key={i.id}
                  to="/imovel/$slug"
                  params={{ slug: i.slug }}
                  className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {fotosMap[i.id] ? (
                      <img
                        src={fotosMap[i.id]}
                        alt={i.titulo}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        sem foto
                      </div>
                    )}
                    <Badge className="absolute left-3 top-3 shadow-sm">
                      {FINALIDADE_LABEL[i.finalidade] ?? i.finalidade}
                    </Badge>
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-1 font-semibold">{i.titulo}</h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{" "}
                      {[i.endereco_bairro, i.endereco_cidade].filter(Boolean).join(", ") || "—"}
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <span className="block text-lg font-bold text-primary">
                        {formatBRL(i.preco)}
                      </span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {i.quartos != null && (
                          <span className="flex items-center gap-1">
                            <Bed className="h-3 w-3" /> {i.quartos}
                          </span>
                        )}
                        {i.banheiros != null && (
                          <span className="flex items-center gap-1">
                            <Bath className="h-3 w-3" /> {i.banheiros}
                          </span>
                        )}
                        {i.area_util != null && (
                          <span className="flex items-center gap-1">
                            <Maximize2 className="h-3 w-3" /> {i.area_util}m²
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SiteWidgetsLayout>
      </section>

      {/* ── Sobre nós ────────────────────────────────────────── */}
      {sobre && (
        <section id="sobre" className="border-t border-border bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h2 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">Sobre nós</h2>
              <article
                className="prose prose-sm max-w-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: sobre }}
              />
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-primary p-10 text-primary-foreground">
              <ShieldCheck className="absolute -bottom-6 -right-6 h-32 w-32 opacity-15" />
              <p className="relative text-sm font-medium uppercase tracking-wider opacity-80">
                Compromisso
              </p>
              <p className="relative mt-3 text-xl font-bold leading-snug">
                Atendimento próximo, transparente e feito sob medida para você.
              </p>
            </div>
          </div>
        </section>
      )}

      <ContactSection ctx={ctx} />
    </TenantSiteLayout>
  );
}

function ContactSection({ ctx }: { ctx: SiteCtx }) {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", mensagem: "" });
  const [sending, setSending] = useState(false);
  const waHref = ctx.settings.contato_whatsapp
    ? `https://wa.me/${ctx.settings.contato_whatsapp.replace(/\D/g, "")}`
    : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.nome.trim().length < 2) return toast.error("Informe seu nome");
    setSending(true);
    const { error } = await supabase.rpc("public_create_tenant_lead" as any, {
      _tenant_slug: ctx.tenantSlug,
      _nome: form.nome.trim(),
      _email: form.email || "",
      _telefone: form.telefone || "",
      _mensagem: form.mensagem || "",
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Tente o WhatsApp ou email do rodapé.");
      return;
    }
    toast.success("Mensagem enviada! Em breve entraremos em contato.");
    setForm({ nome: "", email: "", telefone: "", mensagem: "" });
  }

  return (
    <section id="contato" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">Fale com a gente</h2>
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            Tem alguma dúvida ou quer agendar uma visita? Preencha o formulário ou fale direto pelos
            canais abaixo.
          </p>
          <div className="space-y-4">
            {ctx.settings.contato_telefone && (
              <div className="flex items-center gap-3 text-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Phone className="h-4 w-4" />
                </span>
                {ctx.settings.contato_telefone}
              </div>
            )}
            {ctx.settings.contato_email && (
              <div className="flex items-center gap-3 text-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="h-4 w-4" />
                </span>
                {ctx.settings.contato_email}
              </div>
            )}
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="mt-2 gap-2 rounded-full">
                  <MessageCircle className="h-4 w-4" />
                  Chamar no WhatsApp
                </Button>
              </a>
            )}
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                maxLength={200}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Telefone
              </Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                maxLength={40}
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Mensagem</Label>
            <Textarea
              rows={4}
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              maxLength={2000}
            />
          </div>
          <Button type="submit" disabled={sending} className="w-full gap-2 rounded-full">
            <Send className="h-4 w-4" />
            {sending ? "Enviando…" : "Enviar mensagem"}
          </Button>
        </form>
      </div>
    </section>
  );
}

function NotPublished() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-bold">Site indisponível</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Esta imobiliária ainda não publicou seu site público.
      </p>
      <Link to="/" className="text-sm text-primary hover:underline">
        ← Voltar ao início
      </Link>
    </div>
  );
}
