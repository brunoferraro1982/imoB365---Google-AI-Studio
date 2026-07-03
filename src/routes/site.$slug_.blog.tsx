import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type SiteCtx } from "@/components/site/TenantSiteLayout";
import { TenantSiteLayoutWithWidgets } from "@/components/site/SiteWidgets";

export const Route = createFileRoute("/site/$slug_/blog")({
  component: TenantBlogPage,
  head: ({ params }) => ({
    meta: [{ title: `Blog — ${params.slug}` }],
  }),
});

type Post = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  imagem_url: string | null;
  categoria: string | null;
  publicado_em: string | null;
};

function TenantBlogPage() {
  const { slug } = Route.useParams();
  const [ctx, setCtx] = useState<SiteCtx | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id,slug,nome,tema")
        .eq("slug", slug)
        .maybeSingle();
      if (!tenant) {
        setLoading(false);
        return;
      }
      const [{ data: cfg }, { data: pages }, { data: postsData }] = await Promise.all([
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
          .from("blog_posts")
          .select("id,slug,titulo,resumo,imagem_url,categoria,publicado_em")
          .eq("tenant_id", tenant.id)
          .eq("status", "publicado")
          .order("publicado_em", { ascending: false })
          .limit(30),
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
        settings: cfg,
        pages: (pages ?? []) as { slug: string; titulo: string }[],
        hasBlog: true,
      });
      setPosts((postsData as Post[]) ?? []);
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

  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso)) : "";

  return (
    <TenantSiteLayoutWithWidgets ctx={ctx}>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Blog</h1>
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum artigo publicado ainda.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              to="/site/$slug/blog/$postSlug"
              params={{ slug, postSlug: p.slug }}
              className="group rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
            >
              {p.imagem_url && (
                <img
                  src={p.imagem_url}
                  alt={p.titulo}
                  className="h-40 w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
              )}
              <div className="p-4 space-y-2">
                {p.categoria && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    <Tag className="h-2.5 w-2.5" />
                    {p.categoria}
                  </span>
                )}
                <h2 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {p.titulo}
                </h2>
                {p.resumo && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {p.resumo}
                  </p>
                )}
                {p.publicado_em && (
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <Calendar className="h-3 w-3" />
                    {fmt(p.publicado_em)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </TenantSiteLayoutWithWidgets>
  );
}
