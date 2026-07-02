import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TenantSiteLayout, type SiteCtx } from "@/components/site/TenantSiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/site/$slug_/blog_/$postSlug")({
  component: TenantBlogPostPage,
  head: ({ params }) => ({
    meta: [{ title: `${params.postSlug} — ${params.slug}` }],
  }),
});

type Post = {
  titulo: string;
  resumo: string | null;
  conteudo: string | null;
  imagem_url: string | null;
  categoria: string | null;
  publicado_em: string | null;
  autor: { nome: string | null } | null;
};

function TenantBlogPostPage() {
  const { slug, postSlug } = Route.useParams();
  const [ctx, setCtx] = useState<SiteCtx | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id,slug,nome")
        .eq("slug", slug)
        .maybeSingle();
      if (!tenant) {
        setLoading(false);
        return;
      }
      const [{ data: cfg }, { data: pages }, { data: postData }] = await Promise.all([
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
          .select("titulo,resumo,conteudo,imagem_url,categoria,publicado_em,autor:profiles(nome)")
          .eq("tenant_id", tenant.id)
          .eq("slug", postSlug)
          .eq("status", "publicado")
          .maybeSingle(),
      ]);
      if (!cfg) {
        setLoading(false);
        return;
      }
      setCtx({
        tenantSlug: tenant.slug,
        tenantNome: tenant.nome,
        settings: cfg,
        pages: (pages ?? []) as { slug: string; titulo: string }[],
        hasBlog: true,
      });
      setPost((postData as unknown as Post) ?? null);
      setLoading(false);
    })();
  }, [slug, postSlug]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  if (!ctx || !post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl font-bold">Artigo não encontrado</h1>
        <Link
          to="/site/$slug/blog"
          params={{ slug }}
          className="text-sm text-primary hover:underline"
        >
          ← Voltar ao blog
        </Link>
      </div>
    );
  }

  const formattedDate = post.publicado_em
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(
        new Date(post.publicado_em),
      )
    : null;

  return (
    <TenantSiteLayout ctx={ctx}>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <Button asChild variant="ghost" size="sm" className="mb-6 gap-1.5">
          <Link to="/site/$slug/blog" params={{ slug }}>
            <ArrowLeft className="w-4 h-4" />
            Blog
          </Link>
        </Button>

        {post.categoria && (
          <div className="mb-4">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Tag className="w-3 h-3" />
              {post.categoria}
            </Badge>
          </div>
        )}

        <h1 className="mb-4 text-3xl font-bold tracking-tight leading-tight md:text-4xl">
          {post.titulo}
        </h1>

        {(post.autor?.nome || formattedDate) && (
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {post.autor?.nome && <span>{post.autor.nome}</span>}
            {post.autor?.nome && formattedDate && (
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            )}
            {formattedDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate}
              </span>
            )}
          </div>
        )}

        {post.imagem_url && (
          <div className="mb-8 aspect-video overflow-hidden rounded-xl">
            <img
              src={post.imagem_url}
              alt={post.titulo}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        )}

        <Separator className="mb-8" />

        <div
          className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:shadow-md prose-blockquote:border-l-primary"
          dangerouslySetInnerHTML={{ __html: post.conteudo ?? "" }}
        />
      </article>
    </TenantSiteLayout>
  );
}
