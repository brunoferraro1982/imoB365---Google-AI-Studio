import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ArrowLeft, Calendar, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/integrations/supabase/client'

// ─── Server function ────────────────────────────────────────────────────────

const fetchPostBySlug = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {

    const { data, error } = await supabase
      .from('blog_posts')
      .select(
        'id, slug, titulo, excerpt, conteudo_html, imagem_capa_url, autor_nome, categorias, published_at, seo_title',
      )
      .eq('slug', slug)
      .eq('status', 'published')
      .is('tenant_id', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Post não encontrado')

    return data
  })

// ─── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/blog/$slug')({
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.seo_title ?? loaderData?.titulo ?? 'Blog | imoB365' },
      { name: 'description', content: loaderData?.excerpt ?? '' },
      { property: 'og:title', content: loaderData?.titulo ?? '' },
      { property: 'og:image', content: loaderData?.imagem_capa_url ?? '' },
    ],
  }),

  loader: async ({ params }) => fetchPostBySlug({ data: params.slug }),

  errorComponent: ({ error }) => (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-muted-foreground">
        {error.message === 'Post não encontrado'
          ? 'Este artigo não foi encontrado ou foi removido.'
          : 'Ocorreu um erro ao carregar o artigo.'}
      </p>
      <Button asChild variant="outline">
        <Link to="/blog">← Voltar ao Blog</Link>
      </Button>
    </div>
  ),

  component: BlogPostPage,
})

// ─── Category label map ──────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  investidor: 'Investidor',
  'litoral-sul': 'Litoral Sul',
  planta: 'Planta',
  renda: 'Renda',
}

// ─── Component ──────────────────────────────────────────────────────────────

function BlogPostPage() {
  const post = Route.useLoaderData()

  const formattedDate = post.published_at
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(post.published_at))
    : null

  const categories: string[] = Array.isArray(post.categorias) ? post.categorias : []

  return (
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

      <article className="max-w-4xl mx-auto px-4 py-10">
        {/* ── Categorias ── */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => (
              <Badge key={cat} variant="secondary" className="gap-1 text-xs">
                <Tag className="w-3 h-3" />
                {CAT_LABELS[cat] ?? cat}
              </Badge>
            ))}
          </div>
        )}

        {/* ── Título ── */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-4">
          {post.titulo}
        </h1>

        {/* ── Meta ── */}
        {(post.autor_nome || formattedDate) && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
            {post.autor_nome && <span>{post.autor_nome}</span>}
            {post.autor_nome && formattedDate && (
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
        {post.imagem_capa_url && (
          <div className="mb-8 rounded-xl overflow-hidden aspect-video">
            <img
              src={post.imagem_capa_url}
              alt={post.titulo}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )}

        <Separator className="mb-8" />

        {/* ── Conteúdo WordPress ── */}
        <div
          className="prose prose-neutral dark:prose-invert max-w-none
            prose-headings:font-semibold prose-headings:tracking-tight
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-lg prose-img:shadow-md
            prose-blockquote:border-l-primary"
          dangerouslySetInnerHTML={{ __html: post.conteudo_html ?? '' }}
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
  )
}
