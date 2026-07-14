import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCorporateTenantId } from "@/lib/corporateTenant";
import { ArrowLeft, Calendar, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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

    return data;
  });

// ─── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/blog_/$slug")({
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.seo_titulo ?? loaderData?.titulo ?? "Blog | imoB365" },
      { name: "description", content: loaderData?.resumo ?? "" },
      { property: "og:title", content: loaderData?.titulo ?? "" },
      { property: "og:image", content: loaderData?.imagem_url ?? "" },
    ],
  }),

  loader: async ({ params }) => fetchPostBySlug({ data: params.slug }),

  errorComponent: ({ error }) => (
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
  ),

  component: BlogPostPage,
});

// ─── Component ──────────────────────────────────────────────────────────────

function BlogPostPage() {
  const post = Route.useLoaderData();

  const formattedDate = post.publicado_em
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(post.publicado_em))
    : null;

  const autorNome = (post as unknown as { autor?: { nome: string | null } | null }).autor?.nome;

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
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
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

      <article className="max-w-4xl mx-auto px-4 py-10">
        {/* ── Categoria ── */}
        {post.categoria && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="secondary" className="gap-1 text-xs">
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
        {(autorNome || formattedDate) && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
            {autorNome && <span>{autorNome}</span>}
            {autorNome && formattedDate && (
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
            )}
            {formattedDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formattedDate}
              </span>
            )}
          </div>
        )}

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
    </div>
  );
}
