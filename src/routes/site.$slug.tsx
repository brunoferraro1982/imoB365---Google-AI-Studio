import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Building2, MapPin, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TenantSiteLayout, type SiteCtx } from "@/components/site/TenantSiteLayout";
import { SiteWidgetsLayout, useSiteWidgets } from "@/components/site/SiteWidgets";
import { TrackingPixels } from "@/components/site/TrackingPixels";
import { HeroSection } from "@/components/site/sections/HeroSection";
import { ImoveisSection } from "@/components/site/sections/ImoveisSection";
import { SobreSection } from "@/components/site/sections/SobreSection";
import { BlogDestaqueSection } from "@/components/site/sections/BlogDestaqueSection";
import { ContactSection } from "@/components/site/sections/ContactSection";
import { DEFAULT_SECOES, type LayoutKey, type SectionDbItem } from "@/lib/siteSections";

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

function photoUrl(path: string) {
  return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
}

function TenantHome() {
  const { slug } = Route.useParams();
  const { preview } = Route.useSearch();
  const { tenantId: authTenantId } = useAuth();
  const [ctx, setCtx] = useState<SiteCtx | null>(null);
  const [hero, setHero] = useState<any>({});
  const [sobre, setSobre] = useState<string>("");
  const [layout, setLayout] = useState<LayoutKey>("classico");
  const [secoes, setSecoes] = useState<SectionDbItem[]>(DEFAULT_SECOES);
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
      // A prévia (usada em /app/site/previa) só ignora o filtro de publicado
      // quando o próprio membro do tenant está olhando o seu site — a
      // policy RLS `site_settings_members_read` já cobre esse acesso, então
      // isso só controla a query no cliente, não abre nenhum acesso novo.
      const isOwnTenantPreview = preview && authTenantId === tenant.id;
      let settingsQuery = supabase
        .from("tenant_site_settings")
        .select("*")
        .eq("tenant_id", tenant.id);
      if (!isOwnTenantPreview) settingsQuery = settingsQuery.eq("publicado", true);

      const [{ data: cfg }, { data: pages }, { data: imv }, { count: blogCount }] =
        await Promise.all([
          settingsQuery.maybeSingle(),
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
        hasSobre: !!cfg.sobre_html?.trim(),
      });
      setHero(cfg);
      setSobre(cfg.sobre_html ?? "");
      setLayout((cfg.layout as LayoutKey) || "classico");
      setSecoes((cfg.secoes as SectionDbItem[] | null) ?? DEFAULT_SECOES);
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
  }, [slug, preview, authTenantId]);

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

  const orderedSections = useMemo(() => secoes.slice().sort((a, b) => a.ordem - b.ordem), [secoes]);

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

      <HeroSection variant={layout} ctx={ctx} hero={hero} stats={stats} />

      {orderedSections.map((s) => {
        if (!s.visivel) return null;
        switch (s.key) {
          case "imoveis":
            return (
              <section key={s.key} id="imoveis" className="mx-auto max-w-6xl px-6 py-20">
                <SiteWidgetsLayout ctx={ctx} esquerda={esquerda} direita={direita}>
                  <ImoveisSection variant={layout} imoveis={imoveis} fotosMap={fotosMap} />
                </SiteWidgetsLayout>
              </section>
            );
          case "sobre":
            return sobre ? (
              <div key={s.key} id="sobre">
                <SobreSection variant={layout} sobre={sobre} />
              </div>
            ) : null;
          case "blog_destaque":
            return (
              <section key={s.key} id="blog" className="mx-auto max-w-6xl px-6 py-20">
                <BlogDestaqueSection
                  variant={layout}
                  tenantId={ctx.tenantId}
                  tenantSlug={ctx.tenantSlug}
                />
              </section>
            );
          case "contato":
            return (
              <div key={s.key} id="contato">
                <ContactSection variant={layout} ctx={ctx} />
              </div>
            );
          default:
            return null;
        }
      })}
    </TenantSiteLayout>
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
