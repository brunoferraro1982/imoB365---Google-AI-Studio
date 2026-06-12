/**
 * Home page — imoB365
 * Espelha imob365.com.br com todas as seções e diferenciais.
 *
 * Seções:
 *  1. Hero — "Onde o Luxo Encontra o Mar" + CTA
 *  2. Stats — 365 dias | 3 cidades | R$3MI portfólio
 *  3. Diferenciais — 3 pilares (Dados, Curadoria, Tecnologia)
 *  4. Categorias de imóveis — Apartamentos, Casas, Corporativo, Terrenos
 *  5. Serviços de Consultoria — 6 cards
 *  6. Blog Preview — últimos 3 posts do Supabase
 *  7. Parceiras — Construtoras e parceiras
 *  8. Depoimentos — 4 clientes reais
 *  9. Newsletter
 * 10. Footer
 */

import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Gem,
  MapPin,
  MessageCircle,
  Phone,
  Quote,
  Search,
  Shield,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

type BlogPost = {
  id: string
  slug: string
  titulo: string
  excerpt: string | null
  imagem_capa_url: string | null
  categorias: string[]
  published_at: string | null
}

// ─── Server functions ─────────────────────────────────────────────────────────

const fetchLatestPosts = createServerFn({ method: 'GET' }).handler(async () => {


  const { data } = await supabase
    .from('blog_posts')
    .select('id, slug, titulo, excerpt, imagem_capa_url, categorias, published_at')
    .eq('status', 'published')
    .is('tenant_id', null)
    .order('published_at', { ascending: false })
    .limit(3)

  return (data ?? []) as BlogPost[]
})

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      {
        title: 'imoB365 — Imóveis de Alto Padrão no Litoral Sul de São Paulo',
      },
      {
        name: 'description',
        content:
          'Consultoria imobiliária especializada em Santos, Praia Grande e São Vicente. Coberturas, imóveis frente ao mar e lançamentos exclusivos.',
      },
    ],
  }),
  loader: async () => ({
    posts: await fetchLatestPosts(),
  }),
  component: HomePage,
})

// ─── Constants ────────────────────────────────────────────────────────────────

const WHATSAPP_URL = 'https://wa.me/+5513997794382?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20consultoria.'

const STATS = [
  { value: '365', label: 'dias por ano atendendo', suffix: '' },
  { value: '3', label: 'cidades no Litoral Sul', suffix: '' },
  { value: 'R$ 3 MI', label: 'em portfólio disponível', suffix: '' },
  { value: '100%', label: 'curadoria sem conflito', suffix: '' },
]

const PILARES = [
  {
    icon: BarChart3,
    title: 'Dados e Performance',
    desc: 'Analisamos o m² real, histórico de valorização e potencial de ROI. Você decide com inteligência, não com promessas.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Gem,
    title: 'Curadoria de Luxo',
    desc: 'Selecionamos coberturas, unidades Garden e imóveis frente ao mar com acabamento premium e liquidez comprovada.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: Shield,
    title: 'Tecnologia e Transparência',
    desc: 'Plataforma moderna para facilitar a jornada de compra, gestão e segurança jurídica em cada etapa da negociação.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
]

const CATEGORIAS = [
  { label: 'Apartamentos', href: '/buscar?tipo=apartamento', emoji: '🏢' },
  { label: 'Casas', href: '/buscar?tipo=casa', emoji: '🏡' },
  { label: 'Coberturas', href: '/buscar?tipo=cobertura', emoji: '🌅' },
  { label: 'Terrenos', href: '/buscar?tipo=terreno', emoji: '📐' },
  { label: 'Corporativo', href: '/buscar?tipo=comercial', emoji: '🏛️' },
  { label: 'Lançamentos', href: '/buscar?tipo=lancamento', emoji: '🔑' },
]

const SERVICOS = [
  {
    icon: Building2,
    title: 'Administração de Imóveis',
    desc: 'Administramos seu imóvel com total tranquilidade jurídica, da locação à manutenção.',
  },
  {
    icon: Shield,
    title: 'Gestão Contratual',
    desc: 'Elaboração, gestão e administração contratual com segurança total para comprador e vendedor.',
  },
  {
    icon: Users,
    title: 'Consultoria Especializada',
    desc: 'Parceria imobiliária com análise profunda de mercado, ROI e potencial de valorização.',
  },
  {
    icon: Star,
    title: 'Lançamentos Exclusivos',
    desc: 'Acesso antecipado a empreendimentos de alto padrão antes de chegarem ao mercado.',
  },
  {
    icon: Gem,
    title: 'Imóveis Mobiliados',
    desc: 'Adquira seu imóvel completo, decorado e pronto para usar — sem preocupações.',
  },
  {
    icon: TrendingUp,
    title: 'Imóveis de Alto Padrão',
    desc: 'Carteira exclusiva com os melhores imóveis de alto padrão do Litoral Sul de SP.',
  },
]

const DEPOIMENTOS = [
  {
    texto:
      'A consultoria da imoB365 se destaca pela curadoria rigorosa e pelo profundo conhecimento do mercado de alto padrão. É uma parceria pautada na confiança.',
    nome: 'Ricardo M.',
    cargo: 'Diretor Financeiro (CFO)',
    avatar: 'R',
  },
  {
    texto:
      'Em vez de argumentos genéricos, recebi projeções de valorização e estudos de vacância detalhados. É o nível de profissionalismo que o investidor institucional exige.',
    nome: 'Dra. Helena S.',
    cargo: 'Consultora de Investimentos',
    avatar: 'H',
  },
  {
    texto:
      'A gestão imobiliária da imoB365 garante que o patrimônio seja gerido com eficiência máxima e burocracia mínima. Essencial para renda passiva sem preocupações.',
    nome: 'André V.',
    cargo: 'Empresário — Setor de Tecnologia',
    avatar: 'A',
  },
  {
    texto:
      'Entenderam perfeitamente meu perfil, filtrando apenas oportunidades reais de frente para o mar que não estavam no radar comum do mercado.',
    nome: 'Beatriz F.',
    cargo: 'Executiva de Multinacional',
    avatar: 'B',
  },
]

const PARCEIRAS = [
  { nome: 'GMV', url: 'https://imob365.com.br/wp-content/uploads/2026/03/gmv-150x150.jpg' },
  { nome: 'SMA', url: 'https://imob365.com.br/wp-content/uploads/2026/03/SMA-LOGO-VERMELHO_01-1-150x150.png' },
  { nome: 'Atlantika', url: 'https://imob365.com.br/wp-content/uploads/2026/03/ATLANTIKA-INCORPORADORA-DE-IMOVEIS-LTDA.webp' },
]

const CAT_LABELS: Record<string, string> = {
  investidor: 'Investidor',
  'litoral-sul': 'Litoral Sul',
  planta: 'Planta',
  renda: 'Renda',
}

// ─── Component ────────────────────────────────────────────────────────────────

function HomePage() {
  const { posts } = Route.useLoaderData()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate({ to: '/buscar', search: busca ? { q: busca } : {} })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════════════════════════════════════════
          1. HERO
      ═══════════════════════════════════════════════ */}
      <section
        className="relative min-h-[90vh] flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f2d4a 100%)',
        }}
      >
        {/* Overlay textura */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white pt-20">
          <Badge className="mb-6 bg-white/10 text-white border-white/20 backdrop-blur text-sm px-4 py-1.5">
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            Santos · Praia Grande · São Vicente
          </Badge>

          <p className="text-blue-300 text-lg font-medium tracking-widest uppercase mb-2">
            IMÓVEIS DE ALTO PADRÃO NO LITORAL SUL DE SÃO PAULO
          </p>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Onde o Luxo<br />
            <span className="text-blue-400">Encontra o Mar</span>
          </h1>
          <p className="text-white/70 text-xl md:text-2xl mb-10 max-w-2xl mx-auto">
            Não somos uma imobiliária. Somos parceiros do seu patrimônio — com dados, curadoria e transparência total.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex max-w-xl mx-auto gap-2 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar imóvel, bairro ou tipo..."
                className="pl-9 h-12 bg-white text-foreground border-0 shadow-lg"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-6 shrink-0">
              Buscar
            </Button>
          </form>

          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 gap-2">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" />
                Agendar Consultoria
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10">
              <Link to="/buscar">
                Ver imóveis <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Wave bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 80" preserveAspectRatio="none" className="w-full h-16 fill-background">
            <path d="M0,80 C300,20 900,60 1200,10 L1200,80 Z" />
          </svg>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          2. STATS
      ═══════════════════════════════════════════════ */}
      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <p className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ═══════════════════════════════════════════════
          3. DIFERENCIAIS — 3 PILARES
      ═══════════════════════════════════════════════ */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Por que a imoB365?</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Inteligência Imobiliária para o seu Patrimônio
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Nossa metodologia é baseada em três pilares que transformam decisões imobiliárias em vantagem patrimonial duradoura.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {PILARES.map((pilar) => (
              <Card key={pilar.title} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-8">
                  <div className={`w-14 h-14 rounded-2xl ${pilar.bg} flex items-center justify-center mb-6`}>
                    <pilar.icon className={`w-7 h-7 ${pilar.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{pilar.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{pilar.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          4. CATEGORIAS DE IMÓVEIS
      ═══════════════════════════════════════════════ */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <Badge variant="outline" className="mb-3">Portfólio</Badge>
              <h2 className="text-3xl font-bold">Encontre Lançamentos e Pré-vendas</h2>
              <p className="text-muted-foreground mt-2">Exclusividade em toda a região do Litoral Sul</p>
            </div>
            <Button asChild variant="outline" className="hidden md:flex gap-2">
              <Link to="/buscar">
                Ver todos <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORIAS.map((cat) => (
              <Link
                key={cat.href}
                to={cat.href}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-background border border-border hover:border-primary hover:shadow-md transition-all text-center"
              >
                <span className="text-3xl">{cat.emoji}</span>
                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                  {cat.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          5. SERVIÇOS DE CONSULTORIA
      ═══════════════════════════════════════════════ */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Serviços</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Consultoria Imobiliária</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Na imoB365, não apenas intermediamos vendas. Analisamos vacância, potencial de valorização e liquidez.
              Seja para revenda ou renda passiva, entregamos dados — não apenas promessas.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {SERVICOS.map((servico) => (
              <Card
                key={servico.title}
                className="group border border-border hover:border-primary hover:shadow-md transition-all cursor-pointer"
              >
                <CardContent className="p-6 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <servico.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{servico.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{servico.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button asChild size="lg" className="gap-2">
              <Link to="/consultoria">
                Conhecer todos os serviços <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          6. BLOG PREVIEW
      ═══════════════════════════════════════════════ */}
      {posts.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-end justify-between mb-10">
              <div>
                <Badge variant="outline" className="mb-3">Blog</Badge>
                <h2 className="text-3xl font-bold">Inteligência do Mercado</h2>
                <p className="text-muted-foreground mt-2">Análises, tendências e guias para o investidor imobiliário</p>
              </div>
              <Button asChild variant="outline" className="hidden md:flex gap-2">
                <Link to="/blog">
                  Ver todos <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {posts.map((post) => {
                const cats: string[] = Array.isArray(post.categorias) ? post.categorias : []
                const date = post.published_at
                  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
                      new Date(post.published_at),
                    )
                  : null

                return (
                  <Link key={post.id} to="/blog/$slug" params={{ slug: post.slug }} className="group block">
                    <Card className="overflow-hidden border-0 shadow-sm group-hover:shadow-md transition-shadow h-full">
                      {post.imagem_capa_url && (
                        <div className="aspect-video overflow-hidden">
                          <img
                            src={post.imagem_capa_url}
                            alt={post.titulo}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <CardContent className="p-5">
                        {cats.length > 0 && (
                          <div className="flex gap-1.5 mb-3 flex-wrap">
                            {cats.slice(0, 2).map((cat) => (
                              <Badge key={cat} variant="secondary" className="text-xs">
                                {CAT_LABELS[cat] ?? cat}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <h3 className="font-semibold leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                          {post.titulo}
                        </h3>
                        {post.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.excerpt}</p>
                        )}
                        {date && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {date}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>

            <div className="text-center mt-8 md:hidden">
              <Button asChild variant="outline">
                <Link to="/blog">Ver todos os artigos</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          7. PARCEIRAS
      ═══════════════════════════════════════════════ */}
      <section className="py-16 bg-background border-y border-border">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
            Trabalhamos com as principais construtoras do Litoral Sul de São Paulo
          </p>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            {PARCEIRAS.map((p) => (
              <div key={p.nome} className="grayscale hover:grayscale-0 transition-all duration-300 opacity-60 hover:opacity-100">
                <img
                  src={p.url}
                  alt={p.nome}
                  className="h-14 w-auto object-contain"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          8. DEPOIMENTOS
      ═══════════════════════════════════════════════ */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Depoimentos</Badge>
            <h2 className="text-3xl font-bold">O que dizem nossos clientes</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {DEPOIMENTOS.map((dep) => (
              <Card key={dep.nome} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-7">
                  <Quote className="w-8 h-8 text-primary/30 mb-4" />
                  <p className="text-muted-foreground leading-relaxed mb-6 italic">{dep.texto}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      {dep.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{dep.nome}</p>
                      <p className="text-xs text-muted-foreground">{dep.cargo}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          9. CTA CONSULTORIA
      ═══════════════════════════════════════════════ */}
      <section
        className="py-20 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)' }}
      >
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-blue-400 mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para tomar a decisão certa?
          </h2>
          <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
            Agende uma conversa sem compromisso. Vamos entender seus objetivos e apresentar as oportunidades certas para o seu perfil.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="gap-2 bg-green-500 hover:bg-green-600 text-white border-0">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-5 h-5" />
                Agendar via WhatsApp
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 gap-2">
              <Link to="/consultoria">
                <Users className="w-4 h-4" />
                Conhecer serviços
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          10. NEWSLETTER + FOOTER
      ═══════════════════════════════════════════════ */}
      <NewsletterSection />
      <PublicFooter />
    </div>
  )
}

// ─── Newsletter ───────────────────────────────────────────────────────────────

function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: integrar com Supabase newsletter_subscribers
    setSent(true)
  }

  return (
    <section className="py-16 bg-background border-t border-border">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <h3 className="text-2xl font-bold mb-2">Fique por dentro do mercado</h3>
        <p className="text-muted-foreground mb-6">
          Receba lançamentos, pré-vendas e análises exclusivas do Litoral Sul de SP.
        </p>
        {sent ? (
          <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium">
            <CheckCircle2 className="w-5 h-5" />
            Inscrito com sucesso!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
              className="flex-1"
            />
            <Button type="submit">Inscrever</Button>
          </form>
        )}
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-white text-lg">imo<span className="text-blue-400">B365</span></span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400 mb-4">
              Consultoria imobiliária de alto padrão no Litoral Sul de São Paulo.
            </p>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                (13) 99779-4382
              </p>
              <p className="text-slate-400 pl-5">contato@imob365.com.br</p>
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Acesso Rápido</p>
            <ul className="space-y-2 text-sm">
              {[
                { to: '/', label: 'Home' },
                { to: '/sobre', label: 'Sobre a imoB365' },
                { to: '/blog', label: 'Blog' },
                { to: '/consultoria', label: 'Consultoria' },
                { to: '/contato', label: 'Contato' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categorias */}
          <div>
            <p className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Mais Procurados</p>
            <ul className="space-y-2 text-sm">
              {[
                { to: '/buscar?categoria=investidor', label: 'Imóvel para Investidor' },
                { to: '/buscar?categoria=renda', label: 'Imóvel para Renda' },
                { to: '/buscar?categoria=planta', label: 'Imóvel na Planta' },
                { to: '/buscar?categoria=litoral-sul', label: 'Imóveis no Litoral Sul' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Redes sociais */}
          <div>
            <p className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Redes Sociais</p>
            <div className="flex gap-3">
              {[
                { href: 'https://www.instagram.com/imob365/', label: 'Instagram' },
                { href: 'https://www.facebook.com/imob365/', label: 'Facebook' },
                { href: 'https://www.linkedin.com/company/imob365/', label: 'LinkedIn' },
                { href: 'https://wa.me/+5513997794382', label: 'WhatsApp' },
              ].map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 hover:text-white transition-colors"
                >
                  {s.label[0]}
                </a>
              ))}
            </div>
          </div>
        </div>

        <Separator className="bg-slate-700 mb-6" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} imoB365 — Tecnologia Imobiliária. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link to="/politica-de-privacidade" className="hover:text-slate-300 transition-colors">
              Política de Privacidade
            </Link>
            <Link to="/termos" className="hover:text-slate-300 transition-colors">
              Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

// Re-exports de compatibilidade — componentes usados por outras rotas
export { SiteHeader, SiteFooter } from '@/components/site-layout'
