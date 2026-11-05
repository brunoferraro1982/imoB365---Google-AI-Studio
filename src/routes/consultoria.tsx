import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calculator,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileSignature,
  FileText,
  Gem,
  Handshake,
  Headset,
  Home,
  KeyRound,
  MessageCircle,
  Ruler,
  Search,
  ShieldCheck,
  Sofa,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { seoHead, getSeoConfig } from "@/lib/seo";

export const Route = createFileRoute("/consultoria")({
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/consultoria",
      title: "Consultoria Imobiliária | imoB365",
      description:
        "Administração de imóveis, gestão contratual, consultoria, lançamentos, imóveis mobiliados e de alto padrão — cada serviço com um fluxo claro, do diagnóstico ao resultado.",
    }),
  component: ConsultoriaPage,
});

interface Service {
  id: string;
  titulo: string;
  descricao: string | null;
  icone_url: string | null;
  ordem: number;
}

type Etapa = { icon: LucideIcon; titulo: string; texto: string };
type Detalhe = {
  icon: LucideIcon;
  cor: string;
  descricao: string;
  inclui: string[];
  fluxo: Etapa[];
  resultado: string;
};

// Conteúdo de cada serviço (o banco guarda só título/descrição curtos).
// A chave é o título normalizado; serviço novo sem conteúdo aqui cai no
// fluxo genérico, sem quebrar a página.
const DETALHES: Record<string, Detalhe> = {
  "administracao de imoveis": {
    icon: Home,
    cor: "bg-blue-100/80 text-blue-800",
    descricao:
      "Cuidamos do seu imóvel de ponta a ponta — da escolha do inquilino ao repasse mensal — com segurança jurídica e relatórios claros.",
    inclui: [
      "Análise de crédito do inquilino",
      "Contrato e vistoria de entrada",
      "Cobrança, repasse e reajustes",
      "Manutenção e prestação de contas",
    ],
    fluxo: [
      { icon: Calculator, titulo: "Avaliação e preço", texto: "Valor de locação pelo mercado" },
      { icon: Search, titulo: "Seleção do inquilino", texto: "Divulgação e análise de crédito" },
      { icon: FileSignature, titulo: "Contrato e vistoria", texto: "Garantias e laudo de entrada" },
      { icon: Wallet, titulo: "Gestão mensal", texto: "Cobrança, repasse e manutenção" },
    ],
    resultado: "Renda previsível, sem dor de cabeça",
  },
  "gestao contratual": {
    icon: FileText,
    cor: "bg-purple-100/80 text-purple-800",
    descricao:
      "Elaboração, revisão e acompanhamento de contratos de compra, venda e locação, com assinatura digital e controle de prazos.",
    inclui: [
      "Minutas sob medida para cada negócio",
      "Análise documental (due diligence)",
      "Assinatura digital com validade jurídica",
      "Alertas de vencimento e reajuste",
    ],
    fluxo: [
      { icon: ClipboardCheck, titulo: "Documentos", texto: "Levantamento do imóvel e das partes" },
      { icon: ShieldCheck, titulo: "Due diligence", texto: "Certidões, matrícula e riscos" },
      { icon: FileText, titulo: "Minuta e cláusulas", texto: "Negociação dos termos" },
      { icon: FileSignature, titulo: "Assinatura digital", texto: "Registro e acompanhamento" },
    ],
    resultado: "Contrato seguro e acompanhado",
  },
  consultoria: {
    icon: Users,
    cor: "bg-primary/10 text-primary",
    descricao:
      "Entendemos o seu objetivo — morar, investir ou diversificar — e indicamos o ativo certo, com dados de mercado e acompanhamento até a escritura.",
    inclui: [
      "Diagnóstico do seu perfil e objetivo",
      "Estudo de mercado, valorização e retorno",
      "Parceria com corretores especialistas",
      "Acompanhamento até o registro",
    ],
    fluxo: [
      { icon: Search, titulo: "Diagnóstico", texto: "Objetivo, prazo e orçamento" },
      { icon: TrendingUp, titulo: "Estudo de mercado", texto: "Valorização, liquidez e retorno" },
      { icon: Eye, titulo: "Curadoria", texto: "Opções selecionadas para você" },
      { icon: Handshake, titulo: "Negociação", texto: "Proposta, financiamento e escritura" },
    ],
    resultado: "Decisão segura e patrimônio valorizado",
  },
  lancamentos: {
    icon: Sparkles,
    cor: "bg-amber-100/80 text-amber-800",
    descricao:
      "Acesso antecipado a lançamentos e empreendimentos na planta, com tabela da construtora, plantas e condições de pagamento atualizadas.",
    inclui: [
      "Tabelas e disponibilidade atualizadas",
      "Plantas, implantação e memorial",
      "Simulação do fluxo de pagamento",
      "Acompanhamento da obra até as chaves",
    ],
    fluxo: [
      { icon: Building2, titulo: "Empreendimento", texto: "Localização, padrão e entrega" },
      { icon: Ruler, titulo: "Unidade e planta", texto: "Andar, metragem e posição" },
      { icon: Calculator, titulo: "Fluxo de pagamento", texto: "Entrada, mensais e financiamento" },
      { icon: FileSignature, titulo: "Reserva e contrato", texto: "Direto com a construtora" },
    ],
    resultado: "Chaves na mão, com a obra acompanhada",
  },
  "imoveis mobiliados": {
    icon: Sofa,
    cor: "bg-emerald-100/80 text-emerald-800",
    descricao:
      "Imóveis prontos para morar ou alugar, com projeto de decoração e mobília inclusos — você escolhe, nós cuidamos do resto.",
    inclui: [
      "Projeto de interiores sob medida",
      "Compra, entrega e montagem",
      "Vistoria final com checklist",
      "Pronto para morar",
    ],
    fluxo: [
      { icon: Home, titulo: "Escolha do imóvel", texto: "Perfil de uso e orçamento" },
      { icon: Ruler, titulo: "Projeto de decoração", texto: "Layout, móveis e acabamentos" },
      { icon: Truck, titulo: "Compra e montagem", texto: "Fornecedores e instalação" },
      { icon: ClipboardCheck, titulo: "Vistoria e entrega", texto: "Checklist item a item" },
    ],
    resultado: "Imóvel pronto para morar ou render",
  },
  "imoveis de alto padrao": {
    icon: Gem,
    cor: "bg-rose-100/80 text-rose-800",
    descricao:
      "Carteira exclusiva de imóveis de alto padrão, com visitas privativas, discrição total e negociação conduzida por especialistas.",
    inclui: [
      "Curadoria por localização e liquidez",
      "Visitas privativas e agendadas",
      "Avaliação técnica do imóvel",
      "Negociação e documentação completas",
    ],
    fluxo: [
      { icon: Users, titulo: "Perfil e preferências", texto: "O que é essencial para você" },
      { icon: Gem, titulo: "Curadoria exclusiva", texto: "Opções fora do óbvio" },
      { icon: CalendarCheck, titulo: "Visitas privativas", texto: "No seu tempo, com discrição" },
      { icon: Handshake, titulo: "Avaliação e negociação", texto: "Preço justo e segurança" },
    ],
    resultado: "O imóvel certo, com total discrição",
  },
};

const GENERICO: Detalhe = {
  icon: BadgeCheck,
  cor: "bg-primary/10 text-primary",
  descricao: "",
  inclui: [
    "Diagnóstico da sua necessidade",
    "Proposta clara de trabalho",
    "Acompanhamento até a conclusão",
  ],
  fluxo: [
    { icon: Search, titulo: "Diagnóstico", texto: "Entendemos sua necessidade" },
    { icon: ClipboardCheck, titulo: "Proposta", texto: "Escopo, prazos e valores" },
    { icon: Wrench, titulo: "Execução", texto: "Com acompanhamento" },
    { icon: CheckCircle2, titulo: "Entrega", texto: "Prestação de contas" },
  ],
  resultado: "Serviço concluído com transparência",
};

// Fluxo geral da consultoria, no topo da página.
const MACRO: Etapa[] = [
  { icon: Search, titulo: "Diagnóstico", texto: "" },
  { icon: Eye, titulo: "Curadoria", texto: "" },
  { icon: Handshake, titulo: "Negociação", texto: "" },
  { icon: FileSignature, titulo: "Contrato", texto: "" },
  { icon: KeyRound, titulo: "Pós-venda", texto: "" },
];

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function fraseCase(t: string) {
  const baixo = t.toLocaleLowerCase("pt-BR");
  return baixo.charAt(0).toLocaleUpperCase("pt-BR") + baixo.slice(1);
}

const slugAncora = (t: string) => norm(t).replace(/[^a-z0-9]+/g, "-");

const BLOCO_BRANCO = "relative scroll-mt-24 bg-white px-4 py-10 md:py-12 dark:bg-[#0b1220]";
const BLOCO_CINZA =
  "relative scroll-mt-24 bg-gradient-to-b from-[#f3f4f6] to-[#eef0f3] px-4 py-10 md:py-12 dark:from-[#0f172a] dark:to-[#0f172a]";
const CARD =
  "rounded-3xl border border-black/5 bg-white/80 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5";

/** Fluxograma do serviço: etapas ligadas por setas até o resultado. */
function Fluxograma({ titulo, d }: { titulo: string; d: Detalhe }) {
  return (
    <figure
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1e3a] via-[#14274a] to-[#1b2f57] p-5 text-white"
      aria-label={`Fluxograma do serviço ${titulo}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-3xl"
      />
      <figcaption className="relative mb-4 flex items-center justify-between text-[11px] font-semibold text-white/60">
        <span>Fluxo do serviço</span>
        <span className="rounded-full border border-white/15 px-2 py-0.5">
          {d.fluxo.length} etapas
        </span>
      </figcaption>
      <ol className="relative grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
        {d.fluxo.map((e, i) => (
          <li key={e.titulo} className="relative flex flex-col items-center text-center">
            {i < d.fluxo.length - 1 && (
              <svg
                aria-hidden
                viewBox="0 0 24 12"
                className="absolute left-[calc(50%+24px)] top-[14px] hidden h-3 w-[calc(100%-36px)] text-white/35 sm:block"
                preserveAspectRatio="none"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <path d="M0 6h21M17 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white shadow-md shadow-primary/30">
              <e.icon className="h-4 w-4" />
              <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-white text-[9px] font-black text-[#0f1e3a]">
                {i + 1}
              </span>
            </span>
            <span className="mt-2 text-[12px] font-bold leading-tight">{e.titulo}</span>
            {e.texto && (
              <span className="mt-0.5 text-[10.5px] leading-snug text-white/60">{e.texto}</span>
            )}
          </li>
        ))}
      </ol>
      <div className="relative mt-4 flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/15 px-3.5 py-2.5 text-center text-sm font-bold text-emerald-200">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> {d.resultado}
      </div>
    </figure>
  );
}

function ConsultoriaPage() {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    void supabase
      .from("services")
      .select("id,titulo,descricao,icone_url,ordem")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => setServices((data as Service[]) ?? []));
  }, []);

  return (
    <>
      <SiteHeader />
      <div className="hero-brand min-h-screen bg-white dark:bg-[#0b1220]">
        {/* ─── TOPO ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-white px-4 pb-8 pt-8 md:pt-10 dark:bg-[#0b1220]">
          <div aria-hidden className="mesh-brand-claro pointer-events-none absolute inset-0" />
          <div className="glass-fosco relative mx-auto max-w-6xl space-y-5 rounded-[28px] px-6 py-9 text-center md:px-10 md:py-10">
            <span className="inline-block rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
              Consultoria e Serviços
            </span>
            <h1 className="font-brand-display text-[1.9rem] font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Soluções imobiliárias completas,{" "}
              <span className="text-primary">com um fluxo claro em cada etapa.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Da curadoria ao contrato, cuidamos de cada etapa para que você invista com
              tranquilidade e segurança jurídica em qualquer região do país.
            </p>
            <ol
              className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-1.5 gap-y-2 pt-1"
              aria-label="Fluxo geral da consultoria"
            >
              {MACRO.map((e, i) => (
                <li key={e.titulo} className="flex items-center gap-1.5">
                  <span className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-bold shadow-sm dark:border-white/10 dark:bg-white/10">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
                      <e.icon className="h-3.5 w-3.5" />
                    </span>
                    {e.titulo}
                  </span>
                  {i < MACRO.length - 1 && <ArrowRight className="h-4 w-4 text-primary/70" />}
                </li>
              ))}
            </ol>
            {services.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {services.map((s) => (
                  <a
                    key={s.id}
                    href={`#${slugAncora(s.titulo)}`}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
                  >
                    {fraseCase(s.titulo)}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── SERVIÇOS: texto (50%) + fluxograma (50%), alternando ── */}
        {services.map((s, idx) => {
          const d = DETALHES[norm(s.titulo)] ?? GENERICO;
          const titulo = fraseCase(s.titulo);
          const invertido = idx % 2 === 1;
          return (
            <section
              key={s.id}
              id={slugAncora(s.titulo)}
              className={idx % 2 === 0 ? BLOCO_CINZA : BLOCO_BRANCO}
            >
              <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
                <div className={`${CARD} space-y-4 p-6 md:p-8 ${invertido ? "md:order-2" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl ${d.cor}`}>
                      {s.icone_url ? (
                        <img src={s.icone_url} alt="" className="h-7 w-7 rounded object-cover" />
                      ) : (
                        <d.icon className="h-6 w-6" />
                      )}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Serviço {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="font-brand-display text-2xl font-extrabold tracking-tight">
                    {titulo}
                  </h2>
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {d.descricao || s.descricao}
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {d.inclui.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-foreground/85">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/contato"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                  >
                    Quero saber mais <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className={invertido ? "md:order-1" : ""}>
                  <Fluxograma titulo={titulo} d={d} />
                </div>
              </div>
            </section>
          );
        })}

        {/* ─── VOCÊ TEM ALGUMA DÚVIDA? (sem barra laranja) ────────── */}
        <section className={services.length % 2 === 0 ? BLOCO_CINZA : BLOCO_BRANCO}>
          <div
            className={`${CARD} mx-auto grid max-w-6xl items-center gap-6 p-6 md:grid-cols-2 md:p-8`}
          >
            <div className="space-y-3">
              <h2 className="font-brand-display text-2xl font-extrabold tracking-tight">
                Você tem alguma dúvida?
              </h2>
              <p className="text-sm text-muted-foreground">
                Nossa equipe atende com qualidade e prazos de resposta definidos (SLA).
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  to="/contato"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
                >
                  Agendar consultoria <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="/atendimento"
                  className="glass-claro inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition hover:bg-white/60"
                >
                  <Headset className="h-4 w-4" /> Central de atendimento
                </a>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  t: "Prazos definidos",
                  d: "Cada solicitação com SLA de resposta",
                },
                { icon: Headset, t: "Protocolo de atendimento", d: "Acompanhe tudo pela Central" },
                { icon: MessageCircle, t: "Sem compromisso", d: "Primeira conversa sem custo" },
              ].map((i) => (
                <li key={i.t} className="rounded-2xl bg-white/70 p-4 dark:bg-white/5">
                  <i.icon className="h-5 w-5 text-primary" />
                  <p className="mt-2 text-sm font-bold">{i.t}</p>
                  <p className="text-xs text-muted-foreground">{i.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
