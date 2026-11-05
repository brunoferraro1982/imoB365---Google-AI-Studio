import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileSignature,
  FileText,
  Filter,
  Globe,
  GraduationCap,
  Handshake,
  Inbox,
  Megaphone,
  MessageSquare,
  Plug,
  Rocket,
  Rss,
  Scale,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { seoHead, getSeoConfig } from "@/lib/seo";
import {
  BLOCO_BRANCO,
  BLOCO_CINZA,
  CARD_GLASS,
  FaixaEtapas,
  HeroGlass,
  PaginaGlass,
  SELO,
  TITULO_SECAO,
} from "@/components/portal/PaginaGlass";
import { Fluxograma, type Etapa } from "@/components/portal/Fluxograma";

export const Route = createFileRoute("/plataforma")({
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/plataforma",
      title: "Plataforma e recursos — imob365",
      description:
        "Tudo que sua imobiliária recebe no imob365: gestão de imóveis e leads, financeiro, marketing multi-portal, jurídico e e-learning, numa única plataforma.",
    }),
  component: PlataformaPage,
});

type Pilar = {
  id: string;
  icon: LucideIcon;
  cor: string;
  title: string;
  desc: string;
  inclui: string[];
  fluxo: Etapa[];
  resultado: string;
};

const PILARES: Pilar[] = [
  {
    id: "imoveis-e-leads",
    icon: Building2,
    cor: "bg-blue-100/80 text-blue-800",
    title: "Gestão completa de imóveis e leads",
    desc: "Cadastro, fotos, funil Kanban, histórico do lead, chat em tempo real, agendamento de visitas e comparação entre imóveis, tudo em um só painel.",
    inclui: [
      "Cadastro com fotos e capa",
      "Funil Kanban de leads",
      "Chat em tempo real",
      "Agenda de visitas",
    ],
    fluxo: [
      { icon: Camera, titulo: "Cadastro", texto: "Fotos, dados e valor" },
      { icon: Globe, titulo: "Publicação", texto: "Site e portais" },
      { icon: Inbox, titulo: "Lead no funil", texto: "Distribuído ao corretor" },
      { icon: CalendarCheck, titulo: "Visita", texto: "Agendada e registrada" },
    ],
    resultado: "Negócio encaminhado, sem perder lead",
  },
  {
    id: "financeiro",
    icon: DollarSign,
    cor: "bg-emerald-100/80 text-emerald-800",
    title: "Comissão calculada automaticamente, fechamento sem surpresa",
    desc: "Cálculo de comissão, centro de custo, plano de contas e relatórios financeiros num só lugar.",
    inclui: ["Comissão automática", "Centro de custo", "Plano de contas", "Relatórios e DRE"],
    fluxo: [
      { icon: Handshake, titulo: "Negócio fechado", texto: "Venda ou locação" },
      { icon: Calculator, titulo: "Comissão", texto: "Calculada sozinha" },
      { icon: FileText, titulo: "Lançamento", texto: "Centro de custo e contas" },
      { icon: BarChart3, titulo: "Relatórios", texto: "Faturamento do período" },
    ],
    resultado: "Fechamento mensal sem surpresa",
  },
  {
    id: "marketing",
    icon: Megaphone,
    cor: "bg-primary/10 text-primary",
    title: "Publique uma vez, apareça nos principais portais",
    desc: "Feed automático para os principais portais imobiliários, blog integrado, branding e site com a sua marca.",
    inclui: [
      "Feed automático para portais",
      "Site com a sua marca",
      "Blog integrado",
      "Redes sociais",
    ],
    fluxo: [
      { icon: Camera, titulo: "Cadastre uma vez", texto: "Imóvel completo" },
      { icon: Rss, titulo: "Feed automático", texto: "Atualiza preço e status" },
      { icon: Globe, titulo: "Portais e site", texto: "Sua marca em todo lugar" },
      { icon: Filter, titulo: "Leads de volta", texto: "Direto no seu funil" },
    ],
    resultado: "Mais alcance com menos trabalho",
  },
  {
    id: "juridico",
    icon: Scale,
    cor: "bg-purple-100/80 text-purple-800",
    title: "Contrato seguro, do modelo à assinatura",
    desc: "Biblioteca de modelos, geração automática, assinatura digital e checklist de documentação.",
    inclui: [
      "Biblioteca de modelos",
      "Geração automática",
      "Assinatura digital",
      "Checklist de documentos",
    ],
    fluxo: [
      { icon: BookOpen, titulo: "Modelo", texto: "Da biblioteca ou seu" },
      { icon: FileText, titulo: "Geração", texto: "Dados do negócio preenchidos" },
      { icon: FileSignature, titulo: "Assinatura", texto: "Digital, com validade jurídica" },
      { icon: ClipboardCheck, titulo: "Checklist", texto: "Documentação conferida" },
    ],
    resultado: "Contrato seguro e rastreável",
  },
  {
    id: "e-learning",
    icon: GraduationCap,
    cor: "bg-amber-100/80 text-amber-800",
    title: "Equipe treinada, resultado maior",
    desc: "Cursos e certificações para corretores hoje, com caminho futuro para credenciamento formal ao CRECI via curso de TTI direto na plataforma.",
    inclui: [
      "Catálogo de cursos",
      "Matrícula da equipe",
      "Acompanhamento de progresso",
      "Certificados",
    ],
    fluxo: [
      { icon: BookOpen, titulo: "Catálogo", texto: "Cursos e modelos" },
      { icon: UserPlus, titulo: "Matrícula", texto: "Sua equipe inteira" },
      { icon: BarChart3, titulo: "Progresso", texto: "Acompanhado por aluno" },
      { icon: Award, titulo: "Certificado", texto: "Emitido ao concluir" },
    ],
    resultado: "Equipe treinada e certificada",
  },
];

const ETAPAS_TOPO = [
  { icon: Inbox, titulo: "Lead" },
  { icon: Users, titulo: "Atendimento" },
  { icon: FileSignature, titulo: "Contrato" },
  { icon: DollarSign, titulo: "Financeiro" },
  { icon: GraduationCap, titulo: "Equipe" },
];

const E_TEM_MAIS = [
  {
    icon: Sparkles,
    title: "Assistente de IA especializado em imóveis",
    desc: "Pergunte sobre financiamento, ITBI, documentação e mercado imobiliário e receba resposta na hora, rodando em infraestrutura própria — sem depender de API paga de terceiro. Acesso ilimitado nos planos Pro e Business.",
  },
  {
    icon: Rocket,
    title: "Onboarding em minutos",
    desc: "Cadastre-se e comece a usar na hora, com 30 dias de teste completo, sem cartão de crédito.",
  },
  {
    icon: Users,
    title: "Portal para o seu cliente final",
    desc: "Favoritos, buscas salvas com alerta por e-mail e chat direto com o corretor, do lado do comprador/locatário.",
  },
  {
    icon: Plug,
    title: "API e webhooks",
    desc: "Para quem já tem um ecossistema próprio e quer integrar sem depender de suporte manual.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança e compliance",
    desc: "Dados isolados por imobiliária, LGPD nativa e auditoria de ações sensíveis.",
  },
];

function PlataformaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <PaginaGlass>
        <HeroGlass
          selo="Plataforma e recursos"
          titulo="Tudo que sua imobiliária precisa,"
          destaque="em um só lugar."
          subtitulo="Do primeiro lead ao contrato assinado, com o financeiro, o marketing e o jurídico integrados numa única plataforma."
        >
          <FaixaEtapas etapas={ETAPAS_TOPO} rotulo="Jornada na plataforma" />
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {PILARES.map((p) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
              >
                {p.title.split(",")[0]}
              </a>
            ))}
          </div>
        </HeroGlass>

        {PILARES.map((p, idx) => {
          const invertido = idx % 2 === 1;
          return (
            <section key={p.id} id={p.id} className={idx % 2 === 0 ? BLOCO_CINZA : BLOCO_BRANCO}>
              <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
                <div
                  className={`${CARD_GLASS} space-y-4 p-6 md:p-8 ${invertido ? "md:order-2" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl ${p.cor}`}>
                      <p.icon className="h-6 w-6" />
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Módulo {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="font-brand-display text-2xl font-extrabold tracking-tight">
                    {p.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-foreground/80">{p.desc}</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {p.inclui.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-foreground/85">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={invertido ? "md:order-1" : ""}>
                  <Fluxograma
                    titulo={p.title}
                    legenda="Fluxo do módulo"
                    etapas={p.fluxo}
                    resultado={p.resultado}
                  />
                </div>
              </div>
            </section>
          );
        })}

        {/* E tem mais */}
        <section className={PILARES.length % 2 === 0 ? BLOCO_CINZA : BLOCO_BRANCO}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 space-y-2">
              <span className={SELO}>E tem mais</span>
              <h2 className={TITULO_SECAO}>Recursos que sustentam a sua operação</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {E_TEM_MAIS.map((m) => (
                <div key={m.title} className={`${CARD_GLASS} flex gap-4 p-5`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">{m.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final compacto */}
        <section className={PILARES.length % 2 === 0 ? BLOCO_BRANCO : BLOCO_CINZA}>
          <div
            className={`${CARD_GLASS} mx-auto grid max-w-6xl items-center gap-4 p-6 md:grid-cols-2 md:p-8`}
          >
            <div>
              <h2 className="font-brand-display text-xl font-extrabold tracking-tight">
                Pronto para ver a sua imobiliária em um só lugar?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Teste grátis por 30 dias no plano Business. Sem cartão de crédito.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
              >
                Comece grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:contato@imob365.com.br"
                className="glass-claro inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition hover:bg-white/60"
              >
                <MessageSquare className="h-4 w-4" /> Falar com vendas
              </a>
            </div>
          </div>
        </section>
      </PaginaGlass>
      <SiteFooter />
    </div>
  );
}
