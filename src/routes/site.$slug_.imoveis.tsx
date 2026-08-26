import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bed, Bath, Maximize2, MapPin, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { type SiteCtx } from "@/components/site/TenantSiteLayout";
import { TenantSiteLayoutWithWidgets } from "@/components/site/SiteWidgets";
import { formatBRL, FINALIDADE_LABEL, imovelFotoUrl } from "@/lib/format";

export const Route = createFileRoute("/site/$slug_/imoveis")({
  component: TenantImoveisPage,
  head: ({ params }) => ({
    meta: [{ title: `Imóveis — ${params.slug}` }],
  }),
});

type Imovel = {
  id: string;
  slug: string;
  titulo: string;
  tipo: string;
  finalidade: string;
  preco: number | null;
  quartos: number | null;
  banheiros: number | null;
  area_util: number | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
};

function TenantImoveisPage() {
  const { slug } = Route.useParams();
  const [ctx, setCtx] = useState<SiteCtx | null>(null);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [fotosMap, setFotosMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id,slug,nome,tema,tipo_tenant")
        .eq("slug", slug)
        .maybeSingle();
      if (!tenant) {
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
              "id,slug,titulo,tipo,finalidade,preco,quartos,banheiros,area_util,endereco_bairro,endereco_cidade",
            )
            .eq("tenant_id", tenant.id)
            .eq("publicado", true)
            .eq("status", "ativo")
            .order("publicado_em", { ascending: false }),
          supabase
            .from("blog_posts")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .eq("status", "publicado"),
        ]);
      if (!cfg) {
        setLoading(false);
        return;
      }
      setCtx({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantNome: tenant.nome,
        logoUrl: (tenant.tema as { logo_url?: string } | null)?.logo_url,
        tipoTenant: (tenant as { tipo_tenant?: string | null }).tipo_tenant,
        settings: cfg,
        pages: (pages ?? []) as { slug: string; titulo: string }[],
        hasBlog: (blogCount ?? 0) > 0,
        hasSobre: !!cfg.sobre_html?.trim(),
      });
      const lista = (imv as Imovel[]) ?? [];
      setImoveis(lista);
      if (lista.length) {
        const { data: fotos } = await supabase
          .from("imovel_fotos")
          .select("imovel_id,storage_path,capa,ordem")
          .in(
            "imovel_id",
            lista.map((i) => i.id),
          )
          .order("capa", { ascending: false })
          .order("ordem");
        const map: Record<string, string> = {};
        (fotos ?? []).forEach((f) => {
          if (!map[f.imovel_id]) map[f.imovel_id] = imovelFotoUrl(f.storage_path);
        });
        setFotosMap(map);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  if (!ctx) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl font-bold">Site não encontrado</h1>
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <TenantSiteLayoutWithWidgets ctx={ctx}>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Todos os imóveis</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {imoveis.length} {imoveis.length === 1 ? "imóvel publicado" : "imóveis publicados"}
      </p>
      {imoveis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum imóvel publicado no momento.</p>
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
                <h3 className="line-clamp-2 font-semibold leading-snug">{i.titulo}</h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />{" "}
                  {[i.endereco_bairro, i.endereco_cidade].filter(Boolean).join(", ") || "—"}
                </p>
                <div className="mt-3 space-y-1.5">
                  <span className="block text-lg font-bold text-primary">{formatBRL(i.preco)}</span>
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
    </TenantSiteLayoutWithWidgets>
  );
}
