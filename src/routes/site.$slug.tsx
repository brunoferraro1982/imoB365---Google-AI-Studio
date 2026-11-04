import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { Building2, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TenantSiteLayout, SiteSkeleton } from "@/components/site/TenantSiteLayout";
import { SiteWidgetsFaixa, useSiteWidgets } from "@/components/site/SiteWidgets";
import { TrackingPixels } from "@/components/site/TrackingPixels";
import { HeroSection } from "@/components/site/sections/HeroSection";
import { ImoveisSection } from "@/components/site/sections/ImoveisSection";
import { EmpreendimentosSection } from "@/components/site/sections/EmpreendimentosSection";
import {
  ComoFuncionaSection,
  DiferenciaisSection,
} from "@/components/site/sections/DiferenciaisSection";
import { SobreSection } from "@/components/site/sections/SobreSection";
import { BlogDestaqueSection } from "@/components/site/sections/BlogDestaqueSection";
import { ContactSection } from "@/components/site/sections/ContactSection";
import { MobileCtaBar } from "@/components/site/sections/ui";
import { LIMITE_HOME_IMOVEIS, useImoveisSite, useSiteCtx, useTituloSite } from "@/lib/tenantSite";
import {
  normalizarSecoes,
  type LayoutKey,
  type SectionDbItem,
  type Zona,
} from "@/lib/siteSections";

export const Route = createFileRoute("/site/$slug")({
  component: TenantHome,
  validateSearch: (search: Record<string, unknown>): { preview?: boolean } => {
    const preview = search.preview === "1" || search.preview === true;
    return preview ? { preview: true } : {};
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Imóveis` },
      { property: "og:title", content: `${params.slug} — Imóveis` },
      { property: "og:url", content: `/site/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `/site/${params.slug}` }],
  }),
});

function TenantHome() {
  const { slug } = Route.useParams();
  const { preview } = Route.useSearch();
  const { tenantId: authTenantId } = useAuth();
  const ctxQuery = useSiteCtx(slug, { preview, authTenantId });
  const ctx = ctxQuery.data ?? null;
  const imoveisQuery = useImoveisSite(ctx?.tenantId, LIMITE_HOME_IMOVEIS);
  const imoveis = imoveisQuery.data?.imoveis ?? [];
  const imoveisTotal = imoveisQuery.data?.total ?? 0;
  const fotosMap = imoveisQuery.data?.fotosMap ?? {};
  const cfg = (ctx?.settings ?? {}) as Record<string, unknown>;
  const layout = (cfg.layout as LayoutKey) || "classico";
  const secoes = useMemo(
    () => normalizarSecoes(cfg.secoes as SectionDbItem[] | null),
    [cfg.secoes],
  );
  const loading = ctxQuery.isPending || (!!ctx && imoveisQuery.isPending);
  const notFoundState = !ctxQuery.isPending && !ctx;

  useTituloSite(ctx);

  const stats = useMemo(() => {
    const cidades = new Set(imoveis.map((i) => i.endereco_cidade).filter(Boolean));
    const emp = ctx?.empreendimentosTotal ?? 0;
    return [
      imoveisTotal > 0 && {
        icon: Building2,
        label: imoveisTotal === 1 ? "imóvel disponível" : "imóveis disponíveis",
        value: String(imoveisTotal),
      },
      emp > 0 && {
        icon: Sparkles,
        label: emp === 1 ? "lançamento" : "lançamentos",
        value: String(emp),
      },
      cidades.size > 1 && { icon: MapPin, label: "cidades atendidas", value: String(cidades.size) },
    ].filter(Boolean) as { icon: typeof Building2; label: string; value: string }[];
  }, [imoveis, imoveisTotal, ctx?.empreendimentosTotal]);

  const { esquerda, direita } = useSiteWidgets(ctx?.tenantId);

  const orderedSections = useMemo(() => secoes.slice().sort((a, b) => a.ordem - b.ordem), [secoes]);

  if (loading) return <SiteSkeleton />;
  if (notFoundState || !ctx) return <NotPublished />;

  const comFormHero = ctx.settings.hero_formulario !== false;
  const alvoForm = comFormHero ? "receber-opcoes" : "contato";
  const sobre = ctx.settings.sobre_html?.trim() ?? "";

  function renderBlock(s: SectionDbItem, compact: boolean): ReactNode {
    switch (s.key) {
      case "imoveis":
        return (
          <ImoveisSection
            variant={layout}
            imoveis={layout === "boutique" ? imoveis.slice(0, 6) : imoveis}
            fotosMap={fotosMap}
            compact={compact}
            totalCount={imoveisTotal}
            tenantSlug={slug}
          />
        );
      case "empreendimentos":
        return (ctx!.empreendimentosTotal ?? 0) > 0 ? (
          <EmpreendimentosSection
            tenantId={ctx!.tenantId}
            tenantSlug={ctx!.tenantSlug}
            total={ctx!.empreendimentosTotal ?? 0}
            compact={compact}
          />
        ) : null;
      case "diferenciais":
        return <DiferenciaisSection ctx={ctx!} compact={compact} />;
      case "como_funciona":
        return <ComoFuncionaSection ctx={ctx!} compact={compact} alvoForm={alvoForm} />;
      case "sobre":
        return sobre ? (
          <SobreSection variant={layout} ctx={ctx!} sobre={sobre} compact={compact} />
        ) : null;
      case "blog_destaque":
        return !ctx!.hasBlog ? null : (
          <BlogDestaqueSection
            variant={layout}
            tenantId={ctx!.tenantId}
            tenantSlug={ctx!.tenantSlug}
            compact={compact}
          />
        );
      case "contato":
        return <ContactSection variant={layout} ctx={ctx!} compact={compact} />;
      default:
        return null;
    }
  }

  const visiveis = orderedSections.filter((s) => s.visivel && renderBlock(s, false) !== null);
  const widgets = [...esquerda, ...direita];

  let corpo: ReactNode;
  if (layout === "amplo") {
    const byZona = (zona: Zona) => visiveis.filter((s) => (s.zona ?? "content") === zona);
    const navbarItems = byZona("navbar");
    const contentItems = byZona("content");
    const metaItems = byZona("meta");
    const hasNavbar = navbarItems.length > 0;
    const hasMeta = metaItems.length > 0;
    // Colunas laterais só a partir de lg; no celular tudo empilha em 1 coluna.
    const gridColsClass =
      hasNavbar && hasMeta
        ? "lg:grid-cols-[260px_minmax(0,1fr)_260px]"
        : hasNavbar
          ? "lg:grid-cols-[260px_minmax(0,1fr)]"
          : hasMeta
            ? "lg:grid-cols-[minmax(0,1fr)_260px]"
            : "";
    corpo = (
      <>
        <div className={`mx-auto grid max-w-6xl gap-10 px-4 py-14 md:px-6 ${gridColsClass}`}>
          {hasNavbar && (
            <aside className="space-y-8 self-start lg:sticky lg:top-24">
              {navbarItems.map((s) => (
                <div key={s.key} id={s.key} className="scroll-mt-24">
                  {renderBlock(s, true)}
                </div>
              ))}
            </aside>
          )}
          <div className="min-w-0 space-y-16">
            {contentItems.map((s) => (
              <div key={s.key} id={s.key} className="scroll-mt-24">
                {renderBlock(s, false)}
              </div>
            ))}
          </div>
          {hasMeta && (
            <aside className="space-y-8 self-start lg:sticky lg:top-24">
              {metaItems.map((s) => (
                <div key={s.key} id={s.key} className="scroll-mt-24">
                  {renderBlock(s, true)}
                </div>
              ))}
            </aside>
          )}
        </div>
        <SiteWidgetsFaixa ctx={ctx} widgets={widgets} />
      </>
    );
  } else {
    corpo = visiveis.map((s) => (
      <div key={s.key}>
        <section
          id={s.key === "blog_destaque" ? "blog" : s.key}
          className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 md:px-6 md:py-16"
        >
          {renderBlock(s, false)}
        </section>
        {/* Widgets do tenant logo depois da carteira de imóveis. */}
        {s.key === "imoveis" && <SiteWidgetsFaixa ctx={ctx} widgets={widgets} />}
      </div>
    ));
  }

  return (
    <TenantSiteLayout ctx={ctx}>
      <TrackingPixels pixels={ctx.settings as never} />
      <HeroSection variant={layout} ctx={ctx} hero={ctx.settings} stats={stats} />
      {corpo}
      <MobileCtaBar ctx={ctx} alvo={alvoForm} />
      <div className="h-16 md:hidden" aria-hidden />
    </TenantSiteLayout>
  );
}

function NotPublished() {
  return (
    <div className="site-mesh flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f6f7f9] px-6 text-center">
      <div className="glass-fosco max-w-md rounded-3xl p-8">
        <h1 className="text-2xl font-bold">Site indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este site ainda não foi publicado ou o endereço está incorreto.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          ← Voltar ao portal imoB365
        </Link>
      </div>
    </div>
  );
}
