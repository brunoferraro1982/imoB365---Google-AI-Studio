import { InstitutionalNav } from "@/components/site/InstitutionalNav";
// site-layout.tsx — SiteHeader/SiteFooter compartilhados do site público corporativo

import { Link } from "@tanstack/react-router";
import {
  Building2,
  Users,
  Globe2,
  ShieldCheck,
  HeartHandshake,
  Search,
  Building,
  Home,
  Mail,
  Phone,
  Instagram,
  Facebook,
  Linkedin,
  SlidersHorizontal,
  Key,
  CreditCard,
  Calculator,
  Activity,
  Layers,
  Terminal,
  BookOpen,
  PlusCircle,
  Truck,
  Landmark,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { useAuth } from "@/hooks/useAuth";
import { MegaNavHeader, type MegaNavConfig, type MegaNavLeaf } from "@/components/site/MegaNav";

export function SiteHeader() {
  return <SiteHeaderImpl />;
}

const CORPORATE_A_IMOB365_LEAVES: MegaNavLeaf[] = [
  {
    key: "quem-somos",
    to: "/a-imob365",
    hash: "quem-somos",
    label: "Quem Somos",
    desc: "Missão, visão e valores",
  },
  {
    key: "nossa-abordagem",
    to: "/a-imob365",
    hash: "nossa-abordagem",
    label: "Nossa Abordagem",
    desc: "Os 3 pilares da nossa metodologia",
  },
  {
    key: "nosso-padrao",
    to: "/a-imob365",
    hash: "nosso-padrao",
    label: "Nosso Padrão de Curadoria",
    desc: "Como selecionamos cada imóvel",
  },
  {
    key: "numeros",
    to: "/a-imob365",
    hash: "numeros",
    label: "Nossos Números",
    desc: "365 dias, cobertura nacional, R$3MI+",
  },
  {
    key: "servicos",
    to: "/a-imob365",
    hash: "servicos",
    label: "Serviços",
    desc: "Tudo que oferecemos",
  },
  {
    key: "depoimentos",
    to: "/a-imob365",
    hash: "depoimentos",
    label: "Depoimentos",
    desc: "O que nossos clientes dizem",
  },
];

function buildCorporateNavConfig(user: unknown, tenantId: string | null): MegaNavConfig {
  // Cliente final (comprador/locatário) está logado mas nunca tem tenant —
  // "Anunciar Imóvel" precisa levar pro onboarding profissional (vira
  // corretor/imobiliária), não pra /app/imoveis/novo, que quebraria sem tenant.
  const anunciarTo = !user ? "/signup" : tenantId ? "/app/imoveis/novo" : "/onboarding";
  return {
    logo: <Logo className="h-9 w-auto" />,
    logoTo: "/",
    topBar: {
      contacts: [
        { icon: Mail, label: "contato@imob365.com.br", href: "mailto:contato@imob365.com.br" },
        { icon: Phone, label: "(13) 99779-4382", href: "https://wa.me/5513997794382" },
      ],
      nav: <InstitutionalNav />,
    },
    groups: [
      {
        key: "a-imob365",
        label: "A imoB365",
        panelClassName:
          "absolute left-1/2 -translate-x-[200px] top-full mt-2 w-[340px] rounded-2xl border border-border bg-background p-4 shadow-xl z-50",
        columns: [{ eyebrow: "Conheça a imoB365", leaves: CORPORATE_A_IMOB365_LEAVES }],
        ctaLeaf: { label: "Agendar Consultoria", to: "/contato" },
        mobileLabel: "A imoB365",
      },
      {
        key: "encontrar",
        label: "Encontrar Imóveis",
        panelClassName:
          "absolute left-1/2 -translate-x-[150px] top-full mt-2 w-[480px] rounded-2xl border border-border bg-background p-5 shadow-xl grid grid-cols-2 gap-4.5 z-50 overflow-hidden",
        columns: [
          {
            eyebrow: "Disponíveis",
            leaves: [
              {
                key: "comprar",
                to: "/buscar",
                label: "Comprar Imóvel",
                desc: "Apartamentos, coberturas e casas exclusivas.",
                icon: Building2,
                mobileChipClassName:
                  "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white",
              },
              {
                key: "alugar",
                to: "/buscar",
                label: "Alugar Imóvel",
                desc: "Locação ágil, sem burocracia ou fiador tradicional.",
                icon: Key,
                mobileChipClassName:
                  "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white",
              },
              {
                key: "empreendimentos",
                to: "/empreendimentos",
                label: "Empreendimentos",
                desc: "Lançamentos e novos empreendimentos das parceiras.",
                icon: Landmark,
                mobileChipClassName:
                  "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white",
              },
            ],
          },
          {
            eyebrow: "Inteligência",
            leaves: [
              {
                key: "comparador",
                to: "/comparar",
                label: "Comparador",
                desc: "Compare até 4 imóveis lado a lado em tempo real.",
                icon: Layers,
                iconClassName: "text-emerald-600",
                mobileChipClassName:
                  "bg-emerald-100/70 text-emerald-800 group-hover:bg-emerald-600 group-hover:text-white",
              },
              {
                key: "busca-mapa",
                to: "/buscar",
                label: "Busca por Mapa",
                desc: "Navegue pelas melhores regiões de forma geométrica.",
                icon: Search,
                iconClassName: "text-primary",
                mobileChipClassName:
                  "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white",
              },
            ],
          },
        ],
      },
      {
        key: "ferramentas",
        label: "Ferramentas & Simuladores",
        panelClassName:
          "absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[480px] rounded-2xl border border-border bg-background p-5 shadow-xl grid grid-cols-2 gap-4.5 z-50 overflow-hidden",
        columns: [
          {
            eyebrow: "Simuladores",
            leaves: [
              {
                key: "financiamento",
                to: "/calculadora-financiamento",
                label: "Financiamento SAC",
                desc: "Estime as parcelas decrescentes do imóvel de forma simples.",
                icon: Calculator,
                iconClassName: "text-primary",
                mobileChipClassName:
                  "bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white",
              },
              {
                key: "itbi",
                to: "/calculadora-itbi",
                label: "Imposto de ITBI",
                desc: "Verifique taxas de prefeitura e cartório de registro.",
                icon: Calculator,
                iconClassName: "text-orange-500",
                mobileChipClassName:
                  "bg-orange-100 text-orange-700 group-hover:bg-orange-500 group-hover:text-white",
              },
              {
                key: "mudanca",
                to: "/calculadora-mudanca",
                label: "Custo de Mudança",
                desc: "Planeje custos de frete e logística para o novo lar.",
                icon: Truck,
                iconClassName: "text-indigo-500",
                mobileChipClassName:
                  "bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white",
              },
              {
                key: "avaliacao",
                to: "/calculadora-avaliacao",
                label: "Quanto Vale meu Imóvel",
                desc: "Estimativa de valor por CEP, metragem e tipo do imóvel.",
                icon: Home,
                iconClassName: "text-emerald-600",
                mobileChipClassName:
                  "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white",
              },
            ],
          },
          {
            eyebrow: "Análise Cadastral",
            leaves: [
              {
                key: "score-serasa",
                label: "Score Serasa Experian",
                desc: "Validação de CPF de inquilinos e proponentes integrados na hora da proposta (/leads).",
                icon: ShieldCheck,
                iconClassName: "text-sky-700",
                badge: "Novo",
                static: true,
              },
              {
                key: "assistente-ia",
                to: "/",
                hash: "assistente-ia",
                label: "Assistente de IA",
                desc: "Pergunte sobre financiamento, ITBI, mudança e mercado imobiliário.",
                icon: Sparkles,
                iconClassName: "text-primary",
                badge: "Novo",
                mobileChipClassName:
                  "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white",
              },
            ],
          },
        ],
      },
      {
        key: "imobiliarias",
        label: "Para Imobiliárias",
        mobileLabel: "Para Imobiliárias & Corretores",
        panelClassName:
          "absolute right-[120px] top-full mt-2 w-[290px] rounded-2xl border border-border bg-background p-4.5 shadow-xl flex flex-col gap-3.5 z-50 overflow-hidden",
        columns: [
          {
            eyebrow: "Recursos de Negócio",
            leaves: [
              {
                key: "planos",
                to: "/planos",
                label: "Planos & Valores",
                desc: "Do Free ao Business, escolha o plano do tamanho da sua operação.",
                icon: CreditCard,
                iconClassName: "animate-pulse text-primary",
                mobileChipClassName:
                  "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white",
              },
              {
                key: "plataforma",
                to: "/plataforma",
                label: "Plataforma & Recursos",
                desc: "Veja tudo que está incluído: imóveis, financeiro, marketing, jurídico e e-learning.",
                icon: Globe2,
                iconClassName: "text-emerald-600",
                mobileChipClassName:
                  "bg-emerald-100 text-emerald-800 group-hover:bg-emerald-600 group-hover:text-white",
              },
            ],
          },
        ],
      },
      {
        key: "tecnico",
        label: "Área Técnica",
        mobileLabel: "Área Técnica (Devs)",
        flatMobileStyle: true,
        panelClassName:
          "absolute right-0 top-full mt-2 w-[280px] rounded-2xl border border-border bg-background p-4.5 shadow-xl flex flex-col gap-3.5 z-50 overflow-hidden",
        columns: [
          {
            eyebrow: "Recursos Integradores",
            leaves: [
              {
                key: "ajuda",
                to: "/ajuda",
                label: "Central de Ajuda",
                desc: "Guias rápidos por jornada: cadastro, comissões, portais e contratos.",
                icon: BookOpen,
                iconClassName: "text-sky-600",
              },
              {
                key: "docs-api",
                to: "/docs/api",
                label: "Documentação API",
                desc: "Disparadores REST e webhooks técnicos para ERPs de imobiliárias.",
                icon: Terminal,
                labelClassName: "text-emerald-600",
                iconClassName: "text-emerald-600",
              },
              {
                key: "status",
                to: "/status",
                label: "Servidores & APIs",
                desc: "Verificação em tempo real da integridade de bancos de dados.",
                icon: Activity,
                iconClassName: "text-pink-600",
              },
            ],
          },
        ],
      },
    ],
    ctaButton: { label: "Anunciar Imóvel", to: anunciarTo, icon: PlusCircle },
    mobileQuickAction: { label: "Anunciar meu Imóvel", to: anunciarTo, icon: PlusCircle },
    extraCtas: () => <HeaderUserMenu />,
  };
}

function SiteHeaderImpl() {
  const { user, tenantId } = useAuth();
  const config = buildCorporateNavConfig(user, tenantId);
  return <MegaNavHeader config={config} />;
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-secondary text-secondary-foreground">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Logo className="h-9 w-auto" variant="white" />
            <p className="mt-4 text-sm opacity-80 leading-relaxed font-medium">
              A plataforma completa para quem vive de imóveis. Conectamos imobiliárias, corretores e
              clientes em todo o Brasil.
            </p>
            <div className="mt-5 flex gap-3">
              {[
                { Icon: Facebook, href: "https://www.facebook.com/imob365/", label: "Facebook" },
                { Icon: Instagram, href: "https://www.instagram.com/imob365/", label: "Instagram" },
                {
                  Icon: Linkedin,
                  href: "https://www.linkedin.com/company/imob365/",
                  label: "LinkedIn",
                },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-primary hover:border-primary/50 hover:bg-white/10 transition-all duration-300 hover:scale-105"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <FooterCol
            title="Encontrar"
            links={[
              { label: "Comprar imóvel", to: "/buscar", icon: Building2 },
              { label: "Alugar imóvel", to: "/buscar", icon: Key },
              { label: "Imobiliárias parceiras", to: "/buscar", icon: Building },
              { label: "Empreendimentos", to: "/empreendimentos", icon: Landmark },
            ]}
          />
          <FooterCol
            title="Para imobiliárias"
            links={[
              { label: "Planos e preços", to: "/planos", icon: CreditCard },
              { label: "Recursos da plataforma", to: "/plataforma", icon: SlidersHorizontal },
              { label: "Central de Ajuda", to: "/ajuda", icon: BookOpen },
              { label: "Anunciar imóvel", to: "/signup", icon: Building2 },
              { label: "Acessar plataforma", to: "/login", icon: Users },
              {
                label: "Calculadoras (ITBI, financiamento)",
                to: "/calculadoras",
                icon: Calculator,
                highlight: true,
              },
            ]}
          />
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide opacity-90">
              Fale com a gente
            </h4>
            <ul className="mt-4 space-y-3.5 text-sm opacity-85">
              <li className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <span>contato@imob365.com.br</span>
              </li>
              <li>
                <a
                  href="https://wa.me/5513997794382"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 hover:text-primary transition-all duration-200"
                >
                  <div className="p-2 bg-white/5 rounded-lg border border-white/10 shrink-0">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <span>(13) 99779-4382</span>
                </a>
              </li>
              <li className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                  <HeartHandshake className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <span className="font-semibold text-white/95">Suporte 365 dias por ano</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs opacity-70 md:flex-row md:items-center">
          <span>© {year} imob365. Todos os direitos reservados.</span>
          <div className="flex flex-wrap gap-5">
            <Link to="/termos" className="hover:text-primary transition-colors">
              Termos de uso
            </Link>
            <Link to="/privacidade" className="hover:text-primary transition-colors">
              Política de privacidade
            </Link>
            <Link to="/lgpd" className="hover:text-primary transition-colors">
              LGPD
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

interface FooterLink {
  label: string;
  to: string;
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold uppercase tracking-wide opacity-90">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm opacity-85">
        {links.map((l) => {
          const Icon = l.icon;
          const content = (
            <span className="flex items-center gap-2 mb-0.5">
              {Icon && (
                <Icon
                  className={`h-4 w-4 shrink-0 transition-all group-hover:scale-110 ${l.highlight ? "text-primary animate-pulse stroke-[2.25px]" : "opacity-60 group-hover:opacity-100 group-hover:text-white"}`}
                />
              )}
              <span
                className={
                  l.highlight
                    ? "text-primary font-bold tracking-wide relative"
                    : "hover:text-white transition-all"
                }
              >
                {l.label}
                {l.highlight && (
                  <span className="ml-1.5 inline-block text-[9px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.2 rounded-full uppercase font-black tracking-widest leading-none scale-90">
                    ITBI
                  </span>
                )}
              </span>
            </span>
          );

          return (
            <li key={l.label}>
              {l.to.startsWith("/#") ? (
                <a
                  href={l.to}
                  className="group inline-flex items-center text-secondary-foreground hover:translate-x-1.5 transition-all duration-200"
                >
                  {content}
                </a>
              ) : (
                <Link
                  to={l.to}
                  className="group inline-flex items-center text-secondary-foreground hover:translate-x-1.5 transition-all duration-200"
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
