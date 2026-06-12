import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NewsletterCapture } from "@/components/portal/NewsletterCapture";
import { Calendar, Tag } from "lucide-react";
import { SiteHeader, SiteFooter } from '@/components/site-layout'

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog | imoB365 — Mercado Imobiliário do Litoral Sul" },
      { name: "description", content: "Análises, tendências e guias de investimento imobiliário em Praia Grande, Santos e São Vicente." },
    ],
  }),
  component: BlogPage,
});

interface Post {
  id: string;
  slug: string;
  titulo: string;
  excerpt: string | null;
  imagem_capa_url: string | null;
  categorias: string[];
  published_at: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  investidor: "Investidor",
  renda: "Renda",
  planta: "Na Planta",
  "litoral-sul": "Litoral Sul",
};

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string | null>(null);

  useEffect(() => {
    let query = supabase
      .from("blog_posts")
      .select("id,slug,titulo,excerpt,imagem_capa_url,categorias,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(20);

    if (catFilter) {
      query = query.contains("categorias", [catFilter]);
    }
    void query.then(({ data }) => {
      setPosts((data as Post[]) ?? []);
      setLoading(false);
    });
  }, [catFilter]);

  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso)) : "";

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-12 px-4 bg-gradient-to-b from-muted/40 to-background">
        <div className="container max-w-4xl mx-auto text-center space-y-3">
          <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Blog</span>
          <h1 className="text-2xl font-black tracking-tight">Mercado Imobiliário do Litoral Sul</h1>
          <p className="text-sm text-muted-foreground">Análises, tendências e guias de investimento em Santos, Praia Grande e São Vicente.</p>
        </div>
      </section>

      {/* Filtros por categoria */}
      <div className="border-b border-border/40">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {[null, "investidor", "renda", "planta", "litoral-sul"].map((cat) => (
              <button
                key={cat ?? "all"}
                onClick={() => setCatFilter(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  catFilter === cat
                    ? "bg-primary text-white"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat ? CATEGORY_LABELS[cat] : "Todos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts grid */}
      <section className="py-10 px-4">
        <div className="container max-w-4xl mx-auto">
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {[1,2,3,4].map((i) => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : posts.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-12">Nenhum post encontrado.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="group rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
                >
                  {p.imagem_capa_url && (
                    <img
                      src={p.imagem_capa_url}
                      alt={p.titulo}
                      className="h-40 w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  )}
                  <div className="p-4 space-y-2">
                    {p.categorias.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.categorias.map((c) => (
                          <span key={c} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            <Tag className="h-2.5 w-2.5" />{CATEGORY_LABELS[c] ?? c}
                          </span>
                        ))}
                      </div>
                    )}
                    <h2 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {p.titulo}
                    </h2>
                    {p.excerpt && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{p.excerpt}</p>
                    )}
                    {p.published_at && (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Calendar className="h-3 w-3" />{fmt(p.published_at)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-10 px-4 bg-muted/30 border-t border-border/40">
        <div className="container max-w-md mx-auto text-center space-y-3">
          <h3 className="font-black text-sm tracking-tight">Receba lançamentos em primeira mão</h3>
          <p className="text-xs text-muted-foreground">Novidades sobre pré-vendas e valorização do Litoral Sul direto no seu e-mail.</p>
          <NewsletterCapture source="blog" className="justify-center" />
        </div>
      </section>
    </div>
    <SiteFooter />
  </>
  );
}
