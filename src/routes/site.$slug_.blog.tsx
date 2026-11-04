import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteSkeleton, type SiteCtx } from "@/components/site/TenantSiteLayout";
import { SiteNaoEncontrado } from "@/components/site/SiteNaoEncontrado";
import { SecaoTitulo } from "@/components/site/sections/ui";
import { obterSiteCtx, useTituloSite } from "@/lib/tenantSite";
import { useQueryClient } from "@tanstack/react-query";
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
  const qc = useQueryClient();
  const [ctx, setCtx] = useState<SiteCtx | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const c = await obterSiteCtx(qc, slug);
      if (!c) {
        setLoading(false);
        return;
      }
      const { data: postsData } = await supabase
        .from("blog_posts")
        .select("id,slug,titulo,resumo,imagem_url,categoria,publicado_em")
        .eq("tenant_id", c.tenantId)
        .eq("status", "publicado")
        .order("publicado_em", { ascending: false })
        .limit(30);
      setCtx(c);
      setPosts((postsData as Post[]) ?? []);
      setLoading(false);
    })();
  }, [slug, qc]);

  useTituloSite(ctx, "Blog");

  if (loading) return <SiteSkeleton />;
  if (!ctx) return <SiteNaoEncontrado />;

  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso)) : "";

  return (
    <TenantSiteLayoutWithWidgets ctx={ctx}>
      <SecaoTitulo eyebrow="Conteúdo" titulo="Blog" />
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum artigo publicado ainda.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              to="/site/$slug/blog/$postSlug"
              params={{ slug, postSlug: p.slug }}
              className="glass-fosco group overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-1"
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
