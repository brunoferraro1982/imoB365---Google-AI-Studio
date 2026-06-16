import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  ShieldCheck,
  Building2,
  ArrowRight,
  Phone,
  MapPin,
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

export const Route = createFileRoute("/a-imob365")({
  head: () => ({
    meta: [
      { title: "A imoB365 | Inteligência Imobiliária no Litoral Sul de SP" },
      {
        name: "description",
        content:
          "Não somos uma imobiliária — somos parceiros do seu patrimônio. Consultoria especializada em ativos de alto padrão em Praia Grande, Santos e São Vicente, 365 dias por ano.",
      },
    ],
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
    titulo: "Administração de Imóveis",
    descricao: "Administramos seu imóvel para que você tenha tranquilidade jurídica e financeira.",
    icone_url: null,
    ordem: 1,
    icon: Home,
    color: "bg-blue-100/70 text-blue-800",
  },
  {
    id: "2",
    titulo: "Gestão Contratual",
    descricao: "Gestão, elaboração e administração contratual com segurança jurídica total.",
    icone_url: null,
    ordem: 2,
    icon: FileText,
    color: "bg-purple-100/70 text-purple-800",
  },
  {
    id: "3",
    titulo: "Consultoria Imobiliária",
    descricao: "Parceria imobiliária com corretores e clientes em busca do ativo ideal.",
    icone_url: null,
    ordem: 3,
    icon: Users,
    color: "bg-primary/10 text-primary",
  },
  {
    id: "4",
    titulo: "Lançamentos Exclusivos",
    descricao: "Acesso antecipado e exclusivo a imóveis de alto padrão em pré-lançamento.",
    icone_url: null,
    ordem: 4,
    icon: Star,
    color: "bg-amber-100/70 text-amber-800",
  },
  {
    id: "5",
    titulo: "Imóveis Mobiliados",
    descricao: "Adquira seu imóvel sem se preocupar com a decoração — cuidamos de tudo.",
    icone_url: null,
    ordem: 5,
    icon: Wrench,
    color: "bg-emerald-100/70 text-emerald-800",
  },
  {
    id: "6",
    titulo: "Alto Padrão",
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
    titulo: "Dados e Performance",
    desc: "Analisamos o m² real, o histórico de valorização e o potencial de ROI (Retorno sobre Investimento) de cada ativo.",
    color: "bg-blue-100/70 text-blue-800",
  },
  {
    icon: ShieldCheck,
    titulo: "Curadoria de Luxo",
    desc: "Selecionamos apenas empreendimentos que atendem a rigorosos padrões de acabamento, localização e liquidez.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Building2,
    titulo: "Tecnologia e Transparência",
    desc: "Utilizamos as ferramentas mais modernas do mercado para facilitar a jornada de compra e gestão com segurança jurídica total.",
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

const STATS = [
  { valor: "365", label: "Dias por ano atendendo", icon: Star },
  { valor: "3", label: "Cidades no Litoral Sul", icon: MapPin },
  { valor: "R$ 3MI+", label: "Portfólio disponível", icon: TrendingUp },
  { valor: "100%", label: "Foco no seu patrimônio", icon: Eye },
];

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

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-background">

        {/* ─── HERO ───────────────────────────────────────────────── */}
        <section
          id="hero"
          className="relative py-20 px-4 bg-gradient-to-b from-neutral-950 via-neutral-900 to-background overflow-hidden"
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "radial-gradient(circle at 25px 25px, white 2px, transparent 0)",
            backgroundSize: "50px 50px",
          }} />

          <div className="container max-w-4xl mx-auto text-center space-y-6 relative z-10">
            <span className="inline-block bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-primary/30">
              A imoB365
            </span>
            <p className="text-white/60 text-sm font-semibold uppercase tracking-widest">
              Desde a análise até o registro
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Não Somos uma Imobiliária.
              <br />
              <span className="text-primary">Somos Parceiros do Seu Patrimônio.</span>
            </h1>
            <p className="text-white/65 leading-relaxed max-w-2xl mx-auto text-sm sm:text-base">
              A imoB365 transforma decisões imobiliárias em vantagem patrimonial duradoura.
              Operamos 365 dias por ano em Santos, Praia Grande e São Vicente com inteligência,
              dados e total transparência.
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <a
                href="#quem-somos"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("quem-somos")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
              >
                Conheça nossa história <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#servicos"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("servicos")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white/10 transition-colors"
              >
                Ver serviços
              </a>
            </div>
          </div>
        </section>

        {/* ─── QUEM SOMOS ─────────────────────────────────────────── */}
        <section id="quem-somos" className="py-16 px-4 scroll-mt-20">
          <div className="container max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                Quem Somos
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Inteligência Estratégica no Mercado Imobiliário
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Missão */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-wide">Nossa Missão</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Transformar decisões imobiliárias em patrimônio sólido, conectando clientes
                  exigentes às melhores oportunidades do Litoral Sul de São Paulo com inteligência,
                  dados e total transparência.
                </p>
              </div>

              {/* Visão */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100/70 flex items-center justify-center">
                  <Eye className="h-5 w-5 text-blue-700" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-wide">Nossa Visão</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ser a referência em consultoria imobiliária de alto padrão no Litoral Sul de São
                  Paulo, reconhecida pela excelência na análise de mercado e pelo compromisso
                  inabalável com os interesses de nossos clientes.
                </p>
              </div>

              {/* Valores */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100/70 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-wide">Nossos Valores</h3>
                <ul className="space-y-1.5">
                  {VALORES.map((v) => (
                    <li key={v} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Narrativa */}
            <div className="mt-8 rounded-2xl bg-muted/40 border border-border/40 p-6 md:p-8">
              <p className="text-sm text-foreground/80 leading-relaxed">
                A <strong>imoB365</strong> nasceu para preencher uma lacuna no mercado imobiliário
                do Litoral Sul de São Paulo: a necessidade de uma consultoria que entenda o imóvel
                não apenas como uma moradia, mas como um <strong>ativo estratégico</strong>. Com
                foco em Santos, Praia Grande e São Vicente, operamos{" "}
                <strong>365 dias por ano</strong> para garantir que cada oportunidade seja
                capturada no momento certo.
              </p>
            </div>
          </div>
        </section>

        {/* ─── NOSSA ABORDAGEM ─────────────────────────────────────── */}
        <section id="nossa-abordagem" className="py-14 px-4 bg-muted/30 scroll-mt-20">
          <div className="container max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                Nossa Abordagem
              </span>
              <h2 className="text-2xl font-black tracking-tight">
                Diferente das imobiliárias tradicionais
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
                Nossa metodologia é baseada em três pilares que garantem resultados reais e
                patrimônio valorizado.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {PILARES.map((p, i) => (
                <div
                  key={p.titulo}
                  className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 relative overflow-hidden"
                >
                  <span className="absolute top-4 right-4 text-5xl font-black text-muted/20 select-none leading-none">
                    {i + 1}
                  </span>
                  <div className={`h-10 w-10 rounded-xl ${p.color} flex items-center justify-center`}>
                    <p.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-sm">{p.titulo}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── POR QUE O LITORAL SUL ──────────────────────────────── */}
        <section id="litoral-sul" className="py-14 px-4 scroll-mt-20">
          <div className="container max-w-4xl mx-auto">
            <div className="grid gap-8 md:grid-cols-2 items-center">
              <div className="space-y-5">
                <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  Por que o Litoral Sul?
                </span>
                <h2 className="text-2xl font-black tracking-tight">
                  Uma região com potencial de valorização acelerada
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Acreditamos no potencial de valorização acelerada da nossa região. Seja uma
                  cobertura no <strong>Canto do Forte</strong> ou um apartamento Garden na{" "}
                  <strong>Ponta da Praia</strong>, nosso papel é filtrar o ruído do mercado e
                  entregar para você apenas o que é extraordinário.
                </p>
                <div className="space-y-3">
                  {[
                    { icon: MapPin, label: "Santos, Praia Grande e São Vicente" },
                    { icon: TrendingUp, label: "Histórico consistente de valorização" },
                    { icon: Building2, label: "Empreendimentos de alto padrão e liquidez" },
                    { icon: ShieldCheck, label: "Segurança jurídica em cada etapa" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-semibold">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 to-primary/20 p-8 text-center space-y-6">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                  Unimos
                </p>
                {["Curadoria técnica", "Análise de dados", "Atendimento personalizado"].map((item) => (
                  <div key={item} className="rounded-xl bg-background/70 border border-border/40 py-3 px-4">
                    <span className="text-sm font-bold">{item}</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Para investidores e famílias que buscam o melhor do Litoral Sul de SP
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── NÚMEROS ─────────────────────────────────────────────── */}
        <section id="numeros" className="py-14 bg-primary text-white scroll-mt-20">
          <div className="container max-w-4xl mx-auto px-4">
            <div className="text-center mb-8">
              <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">
                Nossos Números
              </p>
              <h2 className="text-xl font-black">Resultados que falam por si</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {STATS.map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-center mb-2">
                    <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                      <s.icon className="h-5 w-5 text-white/80" />
                    </div>
                  </div>
                  <p className="text-3xl font-black">{s.valor}</p>
                  <p className="text-xs text-white/70 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SERVIÇOS ────────────────────────────────────────────── */}
        <section id="servicos" className="py-14 px-4 bg-muted/20 scroll-mt-20">
          <div className="container max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                Serviços
              </span>
              <h2 className="text-2xl font-black tracking-tight">
                Soluções Imobiliárias Completas
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
                Da curadoria ao contrato, cuidamos de cada etapa para que você invista com
                tranquilidade no Litoral Sul de São Paulo.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(services.length > 0
                ? services.map((s) => ({
                    id: s.id,
                    titulo: s.titulo,
                    descricao: s.descricao,
                    icone_url: s.icone_url,
                    icon: Building2,
                    color: "bg-primary/10 text-primary",
                  }))
                : FALLBACK_SERVICES
              ).map((s) => (
                <Link
                  key={s.id}
                  to="/contato"
                  className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <div className={`h-10 w-10 rounded-xl ${s.color} flex items-center justify-center`}>
                    {s.icone_url ? (
                      <img src={s.icone_url} alt="" className="h-6 w-6 object-cover rounded" />
                    ) : (
                      <s.icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm group-hover:text-primary transition-colors">
                      {s.titulo}
                    </h3>
                    {s.descricao && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {s.descricao}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-primary flex items-center gap-1 mt-auto">
                    Saiba mais <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ─── DEPOIMENTOS ─────────────────────────────────────────── */}
        <div id="depoimentos" className="scroll-mt-20">
          <TestimonialsSection />
        </div>

        {/* ─── PARCEIROS ───────────────────────────────────────────── */}
        <div id="parceiros" className="scroll-mt-20">
          <PartnersSection />
        </div>

        {/* ─── CTA FINAL ───────────────────────────────────────────── */}
        <section className="py-16 px-4 text-center bg-gradient-to-b from-background to-muted/40">
          <div className="container max-w-2xl mx-auto space-y-4">
            <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
              Pronto para começar?
            </span>
            <h2 className="text-2xl font-black tracking-tight">
              Agende uma conversa sem compromisso
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Vamos entender seus objetivos e apresentar as oportunidades certas para o seu perfil
              de investimento.
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <Link
                to="/contato"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
              >
                Agendar Consultoria <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://wa.me/5513997794382"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-bold hover:bg-muted transition-colors"
              >
                <Phone className="h-4 w-4" /> WhatsApp
              </a>
              <Link
                to="/buscar"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-bold hover:bg-muted transition-colors"
              >
                Ver Imóveis
              </Link>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
