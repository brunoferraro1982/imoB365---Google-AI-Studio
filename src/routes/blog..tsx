import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { NewsletterCapture } from "@/components/portal/NewsletterCapture";
import { Calendar, ArrowLeft, Tag } from "lucide-react";

export const Route = createFileRoute("/blog/")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!data) throw notFound();
    return data as any;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.titulo ?? "Post"} | imoB365 Blog` },
      { name: "description", content: loaderData?.seo_description ?? loaderData?.excerpt ?? "" },
    ],
  }),
  component: BlogPost,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-2xl font-black">404</p>
        <p className="text-muted-foreground text-sm">Post não encontrado.</p>
        <Link to="/blog" className="text-primary text-sm font-bold hover:underline">← Voltar ao blog</Link>
      </div>
    </div>
  ),
});

function BlogPost() {
  const post = Route.useLoaderData();
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso));

  const CATEGORY_LABELS: Record<string, string> = {
    investidor: "Investidor", renda: "Renda",
    planta: "Na Planta", "litoral-sul": "Litoral Sul",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Cover */}
      {post.imagem_capa_url && (
        <div className="h-64 sm:h-80 w-full overflow-hidden">
          <img src={post.imagem_capa_url} alt={post.titulo} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="container max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Back */}
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao blog
        </Link>

        {/* Header */}
        <div className="space-y-3">
          {post.categorias?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(post.categorias as string[]).map((c) => (
                <span key={c} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  <Tag className="h-2.5 w-2.5" />{CATEGORY_LABELS[c] ?? c}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-2xl font-black tracking-tight leading-snug">{post.titulo}</h1>
          {post.published_at && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />{fmt(post.published_at)}
            </p>
          )}
        </div>

        {/* Content — HTML do WordPress renderizado com sanitização básica */}
        <article
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-black prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: post.conteudo_html ?? "" }}
        />

        {/* Newsletter CTA */}
        <div className="rounded-2xl bg-muted/40 border border-border/60 p-5 space-y-3">
          <p className="font-bold text-sm">Gostou do conteúdo?</p>
          <p className="text-xs text-muted-foreground">Receba análises e lançamentos do Litoral Sul no seu e-mail.</p>
          <NewsletterCapture source="blog-post" />
        </div>
      </div>
    </div>
  );
}
