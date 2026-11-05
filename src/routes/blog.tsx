import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCorporateTenantId } from "@/lib/corporateTenant";
import { NewsletterCapture } from "@/components/portal/NewsletterCapture";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Calendar,
  Handshake,
  MessageCircleQuestion,
  Sparkles,
  Tag,
} from "lucide-react";
import {
  BLOCO_BRANCO,
  BLOCO_CINZA,
  CARD_GLASS,
  FaixaEtapas,
  HeroGlass,
  PaginaGlass,
  SELO,
  TITULO_SECAO,
  fraseCase,
} from "@/components/portal/PaginaGlass";
import { Fluxograma, type Etapa } from "@/components/portal/Fluxograma";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { BlogColumnsLayout } from "@/components/blog/BlogColumnsLayout";
import { seoHead, getSeoConfig } from "@/lib/seo";

export const Route = createFileRoute("/blog")({
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/blog",
      title: "Blog | imoB365 — Notícias do Mercado Imobiliário",
      description:
        "Tenha as principais notícias do mercado imobiliário, análises, tendências e guias de investimento.",
    }),
  component: BlogPage,
});

const ETAPAS_TOPO = [
  { icon: BookOpen, titulo: "Leia" },
  { icon: Calculator, titulo: "Simule" },
  { icon: MessageCircleQuestion, titulo: "Tire dúvidas" },
  { icon: Handshake, titulo: "Decida" },
];

const FLUXO_LEITURA: Etapa[] = [
  { icon: BookOpen, titulo: "Leia o artigo", texto: "Mercado, tendências e guias" },
  { icon: Calculator, titulo: "Simule", texto: "Financiamento, ITBI e mudança" },
  { icon: Sparkles, titulo: "Pergunte à IA", texto: "Dúvidas respondidas na hora" },
  { icon: Handshake, titulo: "Fale conosco", texto: "Especialista no seu caso" },
];

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
      <PaginaGlass>
        <HeroGlass
          selo="Blog"
          titulo="Notícias, análises e guias"
          destaque="do mercado imobiliário."
          subtitulo="Tendências, valorização e investimento explicados de forma simples — para você decidir com mais segurança."
        >
          <FaixaEtapas etapas={ETAPAS_TOPO} rotulo="Do conteúdo à decisão" />
          {categorias.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {[null, ...categorias].map((cat) => (
                <button
                  key={cat ?? "all"}
                  type="button"
                  onClick={() => setCatFilter(cat)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    catFilter === cat
                      ? "bg-primary text-white"
                      : "bg-primary/10 text-primary hover:bg-primary/15"
                  }`}
                >
                  {cat ? fraseCase(cat) : "Todos"}
                </button>
              ))}
            </div>
          )}
        </HeroGlass>

        {/* Posts grid + colunas de imóveis à venda/locação e parceiros */}
        <section className={BLOCO_BRANCO}>
          <BlogColumnsLayout>
            {/* Eyebrow espelhando o rótulo das colunas laterais — junto com o
                badge azul (em vez do laranja usado pelos cards de imóvel),
                deixa claro de longe o que é conteúdo editorial x anúncio. */}
            <h2 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
              Artigos do blog
            </h2>
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 animate-pulse rounded-3xl bg-muted" />
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
                    className={`${CARD_GLASS} group overflow-hidden transition hover:-translate-y-0.5`}
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
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <Tag className="h-2.5 w-2.5" />
                            {fraseCase(p.categoria)}
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

        {/* Do conteúdo à decisão: texto 50% + fluxograma 50% */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Como usar o blog</span>
              <h2 className={TITULO_SECAO}>Do artigo à decisão certa</h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                Cada artigo conversa com as ferramentas do portal: depois de ler, simule os números,
                tire dúvidas com a nossa IA e, quando quiser, fale com um especialista.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/calculadora-financiamento"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary/90"
                >
                  Simular financiamento <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/contato"
                  className="glass-claro inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition hover:bg-white/60"
                >
                  Falar com especialista
                </Link>
              </div>
            </div>
            <Fluxograma
              titulo="Do conteúdo à decisão"
              legenda="Fluxo de leitura"
              etapas={FLUXO_LEITURA}
              resultado="Decisão segura e bem informada"
            />
          </div>
        </section>

        {/* Newsletter (branco, 50%) */}
        <section className={BLOCO_BRANCO}>
          <div
            className={`${CARD_GLASS} mx-auto grid max-w-6xl items-center gap-4 p-6 md:grid-cols-2 md:p-8`}
          >
            <div>
              <p className="font-brand-display text-lg font-extrabold">
                Receba lançamentos em primeira mão
              </p>
              <p className="text-sm text-muted-foreground">
                Novidades sobre pré-vendas e valorização imobiliária direto no seu e-mail.
              </p>
            </div>
            <NewsletterCapture source="blog" className="justify-center md:justify-end" />
          </div>
        </section>
      </PaginaGlass>
      <SiteFooter />
    </>
  );
}
