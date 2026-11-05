import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  ShieldCheck,
  Building2,
  ArrowRight,
  MessageCircle,
  TrendingUp,
  Users,
  Star,
  CheckCircle2,
  Eye,
  FileText,
  Home,
  Wrench,
  Award,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { TestimonialsSection } from "@/components/portal/TestimonialsSection";
import { PartnersSection } from "@/components/portal/PartnersSection";
import { seoHead, getSeoConfig } from "@/lib/seo";

export const Route = createFileRoute("/a-imob365")({
  // Canonical auto-referente (seoHead gera pra /a-imob365) reforça, junto com o
  // 301 de /sobre, que esta é a URL oficial do conteúdo "Sobre" (auditoria GSC).
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/a-imob365",
      title: "A imoB365 | Inteligência Imobiliária de Alto Padrão",
      description:
        "Não somos uma imobiliária — somos parceiros do seu patrimônio. Consultoria especializada em ativos de alto padrão, com dados, tecnologia e atendimento com prazos de resposta definidos em todo o Brasil.",
    }),
  component: AImob365Page,
});

interface Service {
  id: string;
  titulo: string;
  descricao: string | null;
  icone_url: string | null;
  ordem: number;
}

// Fallback para serviços se Supabase não retornar dados
const FALLBACK_SERVICES = [
  {
    id: "1",
    titulo: "Administração de imóveis",
    descricao: "Administramos seu imóvel para que você tenha tranquilidade jurídica e financeira.",
    icone_url: null,
    ordem: 1,
    icon: Home,
    color: "bg-blue-100/70 text-blue-800",
  },
  {
    id: "2",
    titulo: "Gestão contratual",
    descricao: "Gestão, elaboração e administração contratual com segurança jurídica total.",
    icone_url: null,
    ordem: 2,
    icon: FileText,
    color: "bg-purple-100/70 text-purple-800",
  },
  {
    id: "3",
    titulo: "Consultoria imobiliária",
    descricao: "Parceria imobiliária com corretores e clientes em busca do ativo ideal.",
    icone_url: null,
    ordem: 3,
    icon: Users,
    color: "bg-primary/10 text-primary",
  },
  {
    id: "4",
    titulo: "Lançamentos exclusivos",
    descricao: "Acesso antecipado e exclusivo a imóveis de alto padrão em pré-lançamento.",
    icone_url: null,
    ordem: 4,
    icon: Star,
    color: "bg-amber-100/70 text-amber-800",
  },
  {
    id: "5",
    titulo: "Imóveis mobiliados",
    descricao: "Adquira seu imóvel sem se preocupar com a decoração — cuidamos de tudo.",
    icone_url: null,
    ordem: 5,
    icon: Wrench,
    color: "bg-emerald-100/70 text-emerald-800",
  },
  {
    id: "6",
    titulo: "Alto padrão",
    descricao: "Carteira exclusiva com os melhores imóveis de alto padrão da região.",
    icone_url: null,
    ordem: 6,
    icon: Award,
    color: "bg-rose-100/70 text-rose-800",
  },
];

const PILARES = [
  {
    icon: BarChart3,
    titulo: "Dados e performance",
    desc: "Analisamos o m² real, o histórico de valorização e o potencial de ROI (Retorno sobre Investimento) de cada ativo.",
    color: "bg-blue-100/70 text-blue-800",
  },
  {
    icon: ShieldCheck,
    titulo: "Curadoria de luxo",
    desc: "Selecionamos apenas empreendimentos que atendem a rigorosos padrões de acabamento, localização e liquidez.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Building2,
    titulo: "Tecnologia e transparência",
    desc: "Utilizamos as ferramentas mais modernas do mercado — incluindo um assistente de IA próprio pra tirar dúvidas sobre financiamento, ITBI e mercado imobiliário — pra facilitar a jornada de compra e gestão com segurança jurídica total.",
    color: "bg-emerald-100/70 text-emerald-800",
  },
];

const VALORES = [
  "Transparência total em cada etapa da negociação",
  "Discrição absoluta para preservar a privacidade dos clientes",
  "Análise baseada em dados reais de mercado",
  "Curadoria rigorosa sem conflito de interesses",
  "Comprometimento com a valorização do patrimônio a longo prazo",
];

/** "Imóveis de Alto Padrão" → "Imóveis de alto padrão" (títulos vindos do banco). */
function fraseCase(t: string) {
  const baixo = t.toLocaleLowerCase("pt-BR");
  return baixo.charAt(0).toLocaleUpperCase("pt-BR") + baixo.slice(1);
}

// Blocos alternam fundo branco (predominante) e cinza-claro, como na home.
const BLOCO_BRANCO = "relative scroll-mt-24 bg-white px-4 py-12 md:py-14 dark:bg-[#0b1220]";
const BLOCO_CINZA =
  "relative scroll-mt-24 bg-gradient-to-b from-[#f3f4f6] to-[#eef0f3] px-4 py-12 md:py-14 dark:from-[#0f172a] dark:to-[#0f172a]";
const SELO =
  "inline-block rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold tracking-wide text-primary";
const CARD =
  "rounded-3xl border border-black/5 bg-white/80 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5";

function AImob365Page() {
  const [services, setServices] = useState<Service[]>([]);
  const location = useLocation();

  // Scroll suave para âncora ao carregar a página com hash
  useEffect(() => {
    const hash = location.hash;
    if (hash) {
      const id = hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.hash]);

  useEffect(() => {
    void supabase
      .from("services")
      .select("id,titulo,descricao,icone_url,ordem")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        if (data && data.length > 0) setServices(data as Service[]);
      });
  }, []);

  const listaServicos =
    services.length > 0
      ? services.map((sv) => ({
          id: sv.id,
          titulo: fraseCase(sv.titulo),
          descricao: sv.descricao,
          icone_url: sv.icone_url,
          icon: Building2,
          color: "bg-primary/10 text-primary",
        }))
      : FALLBACK_SERVICES;

  return (
    <>
      <SiteHeader />
      <div className="hero-brand min-h-screen bg-white dark:bg-[#0b1220]">
        {/* ─── TOPO ───────────────────────────────────────────────── */}
        <section
          id="hero"
          className="relative overflow-hidden bg-white px-4 pb-8 pt-8 md:pt-10 dark:bg-[#0b1220]"
        >
          <div aria-hidden className="mesh-brand-claro pointer-events-none absolute inset-0" />
          <div className="glass-fosco relative mx-auto max-w-6xl space-y-4 rounded-[28px] px-6 py-9 text-center md:px-10 md:py-11">
            <span className="inline-block rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
              A imoB365
            </span>
            <p className="text-sm font-semibold text-muted-foreground">
              Desde a análise até o registro
            </p>
            <h1 className="font-brand-display text-[1.9rem] font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Não somos uma imobiliária.{" "}
              <span className="text-primary">Somos parceiros do seu patrimônio.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              A imoB365 transforma decisões imobiliárias em vantagem patrimonial duradoura, com
              inteligência, dados e total transparência.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <a
                href="#quem-somos"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("quem-somos")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 transition hover:bg-primary/90"
              >
                Conheça nossa história <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#servicos"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("servicos")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="glass-claro inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition hover:bg-white/60"
              >
                Ver serviços
              </a>
            </div>
          </div>
        </section>

        {/* ─── QUEM SOMOS (cinza) ─────────────────────────────────── */}
        <section id="quem-somos" className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
            <div className={`${CARD} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Quem somos</span>
              <h2 className="font-brand-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                Inteligência estratégica no mercado imobiliário
              </h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                A <strong>imoB365</strong> nasceu para preencher uma lacuna no mercado imobiliário
                de alto padrão: a necessidade de uma consultoria que entenda o imóvel não apenas
                como uma moradia, mas como um <strong>ativo estratégico</strong>. Atuamos em todo o
                Brasil com <strong>qualidade de atendimento e prazos definidos</strong>, para
                garantir que cada oportunidade seja capturada no momento certo.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-primary/[0.06] p-4">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <Star className="h-4 w-4 text-primary" /> Nossa missão
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    Transformar decisões imobiliárias em patrimônio sólido, conectando clientes
                    exigentes às melhores oportunidades do alto padrão.
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-500/[0.06] p-4">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <Eye className="h-4 w-4 text-blue-700" /> Nossa visão
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    Ser a referência nacional em consultoria imobiliária de alto padrão, pela
                    excelência na análise de mercado.
                  </p>
                </div>
              </div>
            </div>
            <div className={`${CARD} p-6 md:p-8`}>
              <p className="flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Nossos valores
              </p>
              <ul className="mt-4 space-y-3">
                {VALORES.map((v) => (
                  <li
                    key={v}
                    className="flex items-start gap-3 rounded-2xl bg-white/70 p-3 text-sm text-foreground/85 dark:bg-white/5"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ─── NOSSA ABORDAGEM (branco) ───────────────────────────── */}
        <section id="nossa-abordagem" className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <span className={SELO}>Nossa abordagem</span>
              <h2 className="font-brand-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                Diferente das imobiliárias tradicionais
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Nossa metodologia é baseada em três pilares que garantem resultados reais e
                patrimônio valorizado.
              </p>
            </div>
            <div className="space-y-3">
              {PILARES.map((p, i) => (
                <div key={p.titulo} className={`${CARD} flex gap-4 p-5`}>
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.color}`}
                  >
                    <p.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">
                      <span className="text-primary">{i + 1}.</span> {p.titulo}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── NOSSO PADRÃO DE CURADORIA (cinza) ──────────────────── */}
        <section id="nosso-padrao" className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-2">
            <div className={`${CARD} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Nosso padrão de curadoria</span>
              <h2 className="font-brand-display text-2xl font-extrabold tracking-tight">
                Cada imóvel passa por uma análise rigorosa antes de chegar até você
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Não trabalhamos com volume — trabalhamos com precisão. Cada oportunidade já passou
                por uma triagem de dados, liquidez e potencial de valorização.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {[
                  { icon: BarChart3, label: "Dados de mercado em tempo real" },
                  { icon: TrendingUp, label: "Histórico e potencial de valorização" },
                  { icon: Building2, label: "Alto padrão e liquidez" },
                  { icon: ShieldCheck, label: "Segurança jurídica em cada etapa" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-xs font-semibold">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3 rounded-3xl bg-gradient-to-br from-[#0f1e3a] to-[#1b2f57] p-6 text-white md:p-8">
              <p className="text-xs font-semibold text-white/60">Unimos</p>
              {["Curadoria técnica", "Análise de dados", "Atendimento personalizado"].map(
                (item) => (
                  <div key={item} className="glass-escuro rounded-2xl px-4 py-3 text-sm font-bold">
                    {item}
                  </div>
                ),
              )}
              <p className="text-xs text-white/60">
                Para investidores e famílias que buscam o melhor do mercado imobiliário de alto
                padrão.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SERVIÇOS (branco) ──────────────────────────────────── */}
        <section id="servicos" className={BLOCO_BRANCO}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 grid items-end gap-3 md:grid-cols-2">
              <div className="space-y-3">
                <span className={SELO}>Serviços</span>
                <h2 className="font-brand-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Soluções imobiliárias completas
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Da curadoria ao contrato, cuidamos de cada etapa para que você invista com
                tranquilidade em qualquer região do país.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listaServicos.map((sv) => (
                <Link
                  key={sv.id}
                  to="/contato"
                  className={`${CARD} group flex items-start gap-3 p-4 transition hover:-translate-y-0.5`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sv.color}`}
                  >
                    {sv.icone_url ? (
                      <img src={sv.icone_url} alt="" className="h-6 w-6 rounded object-cover" />
                    ) : (
                      <sv.icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold transition-colors group-hover:text-primary">
                      {sv.titulo}
                    </h3>
                    {sv.descricao && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {sv.descricao}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary opacity-0 transition group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ─── DEPOIMENTOS (cinza) ────────────────────────────────── */}
        <div
          id="depoimentos"
          className="scroll-mt-24 bg-gradient-to-b from-[#f3f4f6] to-[#eef0f3] dark:from-[#0f172a] dark:to-[#0f172a]"
        >
          <TestimonialsSection />
        </div>

        {/* ─── PARCEIROS (branco) ─────────────────────────────────── */}
        <div id="parceiros" className="scroll-mt-24 bg-white dark:bg-[#0b1220]">
          <PartnersSection />
        </div>

        {/* ─── CTA FINAL (branco, compacto) ───────────────────────── */}
        <section className={BLOCO_BRANCO}>
          <div
            className={`${CARD} mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-center md:flex-row md:text-left`}
          >
            <div>
              <p className="font-brand-display text-lg font-extrabold">
                Agende uma conversa sem compromisso
              </p>
              <p className="text-sm text-muted-foreground">
                Vamos entender seus objetivos e apresentar as oportunidades certas para o seu
                perfil.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/contato"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
              >
                Agendar consultoria <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://wa.me/5513997794382"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <Link
                to="/buscar"
                className="glass-claro inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition hover:bg-white/60"
              >
                Ver imóveis
              </Link>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
