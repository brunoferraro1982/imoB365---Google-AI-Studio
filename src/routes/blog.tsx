import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCorporateTenantId } from "@/lib/corporateTenant";
import { NewsletterCapture } from "@/components/portal/NewsletterCapture";
import { Calendar, Tag } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { BlogColumnsLayout } from "@/components/blog/BlogColumnsLayout";
import { seoHead, readSeoFromMatches } from "@/lib/seo";

export const Route = createFileRoute("/blog")({
  head: ({ matches }) =>
    seoHead({
      seo: readSeoFromMatches(matches),
      path: "/blog",
      title: "Blog | imoB365 — Notícias do Mercado Imobiliário",
      description:
        "Tenha as principais notícias do mercado imobiliário, análises, tendências e guias de investimento.",
    }),
  component: BlogPage,
});

interface Post {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  imagem_url: string | null;
  categoria: string | null;
  publicado_em: string | null;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tenantId = await getCorporateTenantId();
      if (!tenantId || cancelled) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("blog_posts")
        .select("id,slug,titulo,resumo,imagem_url,categoria,publicado_em")
        .eq("tenant_id", tenantId)
        .eq("status", "publicado")
        .order("publicado_em", { ascending: false })
        .limit(20);
      if (!cancelled) {
        setPosts((data as Post[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categorias = useMemo(
    () => [...new Set(posts.map((p) => p.categoria).filter((c): c is string => !!c))],
    [posts],
  );

  const filteredPosts = useMemo(
    () => (catFilter ? posts.filter((p) => p.categoria === catFilter) : posts),
    [posts, catFilter],
  );

  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso)) : "";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "/blog" },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeader />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <section className="py-12 px-4 bg-gradient-to-b from-muted/40 to-background">
          <div className="container max-w-4xl mx-auto text-center space-y-3">
            <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
              Blog
            </span>
            <h1 className="text-2xl font-black tracking-tight">
              Tenha as principais notícias do mercado imobiliário
            </h1>
            <p className="text-sm text-muted-foreground">
              Análises, tendências e guias de investimento imobiliário.
            </p>
          </div>
        </section>

        {/* Filtros por categoria */}
        {categorias.length > 0 && (
          <div className="border-b border-border/40">
            <div className="container max-w-4xl mx-auto px-4">
              <div className="flex gap-1 py-2 overflow-x-auto">
                {[null, ...categorias].map((cat) => (
                  <button
                    key={cat ?? "all"}
                    onClick={() => setCatFilter(cat)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      catFilter === cat
                        ? "bg-primary text-white"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {cat ?? "Todos"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Posts grid + colunas de imóveis à venda/locação e parceiros */}
        <section className="py-10">
          <BlogColumnsLayout>
            {/* Eyebrow espelhando o rótulo das colunas laterais — junto com o
                badge azul (em vez do laranja usado pelos cards de imóvel),
                deixa claro de longe o que é conteúdo editorial x anúncio. */}
            <h2 className="mb-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
              Artigos do Blog
            </h2>
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">
                Nenhum post encontrado.
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {filteredPosts.map((p) => (
                  <Link
                    key={p.id}
                    to="/blog/$slug"
                    params={{ slug: p.slug }}
                    className="group rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-blue-400/50 hover:shadow-md transition-all"
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
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            <Tag className="h-2.5 w-2.5" />
                            {p.categoria}
                          </span>
                        </div>
                      )}
                      <h2 className="font-bold text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
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
          </BlogColumnsLayout>
        </section>

        {/* Newsletter */}
        <section className="py-10 px-4 bg-muted/30 border-t border-border/40">
          <div className="container max-w-md mx-auto text-center space-y-3">
            <h3 className="font-black text-sm tracking-tight">
              Receba lançamentos em primeira mão
            </h3>
            <p className="text-xs text-muted-foreground">
              Novidades sobre pré-vendas e valorização imobiliária direto no seu e-mail.
            </p>
            <NewsletterCapture source="blog" className="justify-center" />
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
