import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCorporateTenantId } from "@/lib/corporateTenant";
import { ArrowLeft, Calendar, ChevronRight, Clock, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { BlogColumnsLayout } from "@/components/blog/BlogColumnsLayout";

// ─── Server function ────────────────────────────────────────────────────────

const fetchPostBySlug = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const tenantId = await getCorporateTenantId();
    if (!tenantId) throw new Error("Post não encontrado");

    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id, slug, titulo, resumo, conteudo, imagem_url, categoria, publicado_em, seo_titulo, autor:profiles(nome)",
      )
      .eq("slug", slug)
      .eq("status", "publicado")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Post não encontrado");

    // Artigos relacionados — mesma categoria, exclui o atual. Mantém o
    // objetivo principal do artigo (o conteúdo) engajando o leitor com mais
    // conteúdo em vez de deixá-lo sair depois de ler um único post.
    let relacionados: {
      id: string;
      slug: string;
      titulo: string;
      imagem_url: string | null;
    }[] = [];
    if (data.categoria) {
      const { data: rel } = await supabase
        .from("blog_posts")
        .select("id,slug,titulo,imagem_url")
        .eq("tenant_id", tenantId)
        .eq("status", "publicado")
        .eq("categoria", data.categoria)
        .neq("id", data.id)
        .order("publicado_em", { ascending: false })
        .limit(3);
      relacionados = rel ?? [];
    }

    return { ...data, relacionados };
  });

// ─── Route ──────────────────────────────────────────────────────────────────

type Post = Awaited<ReturnType<typeof fetchPostBySlug>>;

export const Route = createFileRoute("/blog_/$slug")({
  head: ({ loaderData }) => {
    // TanStack Router não infere corretamente o tipo de retorno do loader
    // nesta combinação com createServerFn (loaderData cai pra `never`) —
    // asserção manual, o errorComponent já garante que os dados existem
    // aqui quando o componente chega a renderizar.
    const post = loaderData as Post | undefined;
    return {
      meta: [
        { title: post?.seo_titulo ?? post?.titulo ?? "Blog | imoB365" },
        { name: "description", content: post?.resumo ?? "" },
        { property: "og:title", content: post?.titulo ?? "" },
        { property: "og:image", content: post?.imagem_url ?? "" },
      ],
    };
  },

  loader: async ({ params }) => fetchPostBySlug({ data: params.slug }),

  errorComponent: ({ error }) => (
    <>
      <SiteHeader />
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-muted-foreground">
          {error.message === "Post não encontrado"
            ? "Este artigo não foi encontrado ou foi removido."
            : "Ocorreu um erro ao carregar o artigo."}
        </p>
        <Button asChild variant="outline">
          <Link to="/blog">← Voltar ao Blog</Link>
        </Button>
      </div>
      <SiteFooter />
    </>
  ),

  component: BlogPostPage,
});

// ─── Component ──────────────────────────────────────────────────────────────

function BlogPostPage() {
  // Mesma asserção de `head` acima — Route.useLoaderData() infere `never`
  // nesta rota; o errorComponent garante que o dado existe aqui.
  const post = Route.useLoaderData() as Post;

  const formattedDate = post.publicado_em
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(post.publicado_em))
    : null;

  const autorNome = (post as unknown as { autor?: { nome: string | null } | null }).autor?.nome;

  const tempoLeitura = useMemo(() => {
    const texto = (post.conteudo ?? "").replace(/<[^>]*>/g, " ");
    const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(palavras / 200));
  }, [post.conteudo]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.seo_titulo ?? post.titulo,
    description: post.resumo ?? undefined,
    image: post.imagem_url ?? undefined,
    datePublished: post.publicado_em ?? undefined,
    author: autorNome
      ? { "@type": "Person", name: autorNome }
      : { "@type": "Organization", name: "imob365" },
    publisher: {
      "@type": "Organization",
      name: "imob365",
      logo: { "@type": "ImageObject", url: "/favicon.png" },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "/blog" },
      { "@type": "ListItem", position: 3, name: post.titulo },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeader />
      <div className="min-h-screen bg-background">
        {/* ── Header de navegação ── */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/blog">
                <ArrowLeft className="w-4 h-4" />
                Blog
              </Link>
            </Button>
          </div>
        </div>

        <div className="py-10">
          <BlogColumnsLayout>
            <article>
              {/* ── Breadcrumb ── */}
              <nav
                aria-label="breadcrumb"
                className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Link to="/blog" className="hover:text-primary">
                  Blog
                </Link>
                {post.categoria && (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    <span>{post.categoria}</span>
                  </>
                )}
                <ChevronRight className="h-3 w-3" />
                <span className="line-clamp-1 text-foreground">{post.titulo}</span>
              </nav>

              {/* ── Categoria ── */}
              {/* Azul (não laranja) de propósito: laranja já identifica
                  "imóvel" na coluna 1 — a categoria do artigo usa a mesma
                  cor de conteúdo/editorial das demais badges do blog. */}
              {post.categoria && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge
                    variant="secondary"
                    className="gap-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    <Tag className="w-3 h-3" />
                    {post.categoria}
                  </Badge>
                </div>
              )}

              {/* ── Título ── */}
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-4">
                {post.titulo}
              </h1>

              {/* ── Meta ── */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
                {autorNome && <span>{autorNome}</span>}
                {autorNome && <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />}
                {formattedDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formattedDate}
                  </span>
                )}
                <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {tempoLeitura} min de leitura
                </span>
              </div>

              {/* ── Imagem de capa ── */}
              {post.imagem_url && (
                <div className="mb-8 rounded-xl overflow-hidden aspect-video">
                  <img
                    src={post.imagem_url}
                    alt={post.titulo}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              )}

              <Separator className="mb-8" />

              {/* ── Conteúdo ── */}
              <div
                className="prose prose-neutral dark:prose-invert max-w-none
                  prose-headings:font-semibold prose-headings:tracking-tight
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-img:rounded-lg prose-img:shadow-md
                  prose-blockquote:border-l-primary"
                dangerouslySetInnerHTML={{ __html: post.conteudo ?? "" }}
              />

              {/* ── Artigos relacionados ── */}
              {post.relacionados.length > 0 && (
                <>
                  <Separator className="my-10" />
                  <section>
                    <h2 className="mb-4 text-lg font-bold tracking-tight">Artigos relacionados</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {post.relacionados.map((r) => (
                        <Link
                          key={r.id}
                          to="/blog/$slug"
                          params={{ slug: r.slug }}
                          className="group rounded-xl border border-border/60 bg-card overflow-hidden hover:border-blue-400/50 hover:shadow-md transition-all"
                        >
                          {r.imagem_url && (
                            <img
                              src={r.imagem_url}
                              alt={r.titulo}
                              className="h-28 w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                            />
                          )}
                          <div className="p-3">
                            <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {r.titulo}
                            </h3>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                </>
              )}

              <Separator className="my-10" />

              {/* ── Navegação pós-leitura ── */}
              <div className="flex justify-between items-center">
                <Button asChild variant="outline">
                  <Link to="/blog">← Ver todos os artigos</Link>
                </Button>
                <Button asChild>
                  <Link to="/consultoria">Falar com especialista</Link>
                </Button>
              </div>
            </article>
          </BlogColumnsLayout>
        </div>
      </div>
      {/* Construtoras Parceiras já aparece na coluna 3 (BlogParceirosColumn)
          — suprime a faixa duplicada que o SiteFooter mostra por padrão. */}
      <SiteFooter hideConstrutorasMarquee />
    </>
  );
}
