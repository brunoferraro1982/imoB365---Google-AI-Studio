import { InstitutionalNav } from "@/components/site/InstitutionalNav";
// site-layout.tsx — SiteHeader/SiteFooter compartilhados do site público corporativo

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  ShieldCheck,
  HeartHandshake,
  Building,
  Home,
  Headset,
  Instagram,
  Facebook,
  Linkedin,
  Key,
  CreditCard,
  Calculator,
  Layers,
  Terminal,
  BookOpen,
  PlusCircle,
  Truck,
  Landmark,
  Sparkles,
  Factory,
  Compass,
  BadgeCheck,
  BarChart3,
  Briefcase,
  Quote,
  Receipt,
  MapPinned,
  ServerCog,
  LayoutGrid,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  IconeVidro,
  MegaNavHeader,
  type MegaNavConfig,
  type MegaNavLeaf,
} from "@/components/site/MegaNav";
import type { LucideIcon } from "lucide-react";

export function SiteHeader() {
  return <SiteHeaderImpl />;
}

const CORPORATE_A_IMOB365_LEAVES: MegaNavLeaf[] = [
  {
    key: "quem-somos",
    icon: Users,
    to: "/a-imob365",
    hash: "quem-somos",
    label: "Quem Somos",
    desc: "Missão, visão e valores",
  },
  {
    key: "nossa-abordagem",
    icon: Compass,
    to: "/a-imob365",
    hash: "nossa-abordagem",
    label: "Nossa Abordagem",
    desc: "Os 3 pilares da nossa metodologia",
  },
  {
    key: "nosso-padrao",
    icon: BadgeCheck,
    to: "/a-imob365",
    hash: "nosso-padrao",
    label: "Nosso Padrão de Curadoria",
    desc: "Como selecionamos cada imóvel",
  },
  {
    key: "numeros",
    icon: BarChart3,
    to: "/a-imob365",
    hash: "numeros",
    label: "Nossos Números",
    desc: "365 dias, cobertura nacional, R$3MI+",
  },
  {
    key: "servicos",
    icon: Briefcase,
    to: "/a-imob365",
    hash: "servicos",
    label: "Serviços",
    desc: "Tudo que oferecemos",
  },
  {
    key: "depoimentos",
    icon: Quote,
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
    tema: "brand",
    logo: <Logo className="h-8 w-auto" variant="white" />,
    logoTo: "/",
    topBar: {
      contacts: [{ icon: Headset, label: "Central de Atendimento", href: "/atendimento" }],
      nav: <InstitutionalNav />,
    },
    groups: [
      {
        key: "a-imob365",
        label: "A imoB365",
        // No desktop fica no top bar, à esquerda de "Sobre" (libera espaço na barra principal)
        posicao: "topbar",
        icon: Building2,
        panelClassName:
          "absolute left-0 top-full mt-2 w-[340px] rounded-2xl border border-border bg-background p-4 shadow-xl z-50",
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
              },
              {
                key: "alugar",
                to: "/buscar",
                label: "Alugar Imóvel",
                desc: "Locação ágil, sem burocracia ou fiador tradicional.",
                icon: Key,
              },
              {
                key: "empreendimentos",
                to: "/empreendimentos",
                label: "Empreendimentos",
                desc: "Lançamentos e novos empreendimentos das parceiras.",
                icon: Building,
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
              },
              {
                key: "busca-mapa",
                to: "/buscar",
                label: "Busca por Mapa",
                desc: "Navegue pelas melhores regiões de forma geométrica.",
                icon: MapPinned,
              },
            ],
          },
        ],
      },
      {
        key: "ferramentas",
        label: "Ferramentas & Simuladores",
        labelCurto: "Ferramentas",
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
                icon: Landmark,
              },
              {
                key: "itbi",
                to: "/calculadora-itbi",
                label: "Imposto de ITBI",
                desc: "Verifique taxas de prefeitura e cartório de registro.",
                icon: Receipt,
              },
              {
                key: "mudanca",
                to: "/calculadora-mudanca",
                label: "Custo de Mudança",
                desc: "Planeje custos de frete e logística para o novo lar.",
                icon: Truck,
              },
              {
                key: "avaliacao",
                to: "/calculadora-avaliacao",
                label: "Quanto Vale meu Imóvel",
                desc: "Estimativa de valor por CEP, metragem e tipo do imóvel.",
                icon: Home,
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
                badge: "Novo",
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
              },
              {
                key: "plataforma",
                to: "/plataforma",
                label: "Plataforma & Recursos",
                desc: "Veja tudo que está incluído: imóveis, financeiro, marketing, jurídico e e-learning.",
                icon: LayoutGrid,
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
              },
              {
                key: "docs-api",
                to: "/docs/api",
                label: "Documentação API",
                desc: "Disparadores REST e webhooks técnicos para ERPs de imobiliárias.",
                icon: Terminal,
              },
              {
                key: "status",
                to: "/status",
                label: "Servidores & APIs",
                desc: "Verificação em tempo real da integridade de bancos de dados.",
                icon: ServerCog,
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

type VitrineItem = {
  key: string;
  tipo: "imobiliaria" | "construtora";
  slug: string;
  nome: string;
  logoUrl: string | null;
};

const CHIP_CLASS =
  "glass-fosco flex h-16 shrink-0 items-center justify-center rounded-2xl bg-white/85 px-6 transition hover:scale-105 hover:bg-white";

function VitrineChip({ it }: { it: VitrineItem }) {
  const inner = it.logoUrl ? (
    <img src={it.logoUrl} alt={it.nome} className="h-9 w-auto object-contain" />
  ) : (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
      {it.tipo === "construtora" ? (
        <Factory className="h-4 w-4" />
      ) : (
        <Building2 className="h-4 w-4" />
      )}
      {it.nome}
    </span>
  );
  // Dois branches (em vez de `to` ternário) pra satisfazer o tipo estrito do
  // Link do TanStack — ambas as rotas usam o param `slug`.
  if (it.tipo === "construtora") {
    return (
      <Link
        to="/construtora/$slug"
        params={{ slug: it.slug }}
        title={it.nome}
        className={CHIP_CLASS}
      >
        {inner}
      </Link>
    );
  }
  return (
    <Link to="/site/$slug" params={{ slug: it.slug }} title={it.nome} className={CHIP_CLASS}>
      {inner}
    </Link>
  );
}

// Vitrine de Parceiros: faixa de logos de imobiliárias + construtoras, curada e
// ordenada pelo super_admin (tabela `vitrine_parceiros`; velocidade em
// `global_settings.vitrine_marquee`). Fundo Liquid Glass acinzentado + cada logo
// num chip de vidro quase branco (logos coloridos legíveis, inclusive no tema escuro).
// Com poucos itens, renderiza estático e centralizado (sem a 2ª cópia do loop,
// que fazia os logos "duplicarem" na tela). Compartilhado entre o SiteFooter
// deste arquivo e o SiteFooter local de routes/index.tsx.
export function ParceirosMarquee() {
  const [itens, setItens] = useState<VitrineItem[]>([]);
  const [speed, setSpeed] = useState(28);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: vp }, { data: cfg }] = await Promise.all([
        // vitrine_parceiros ainda não está em types.ts (tabela nova) — cast
        // (supabase as any), mesmo padrão já usado no projeto pra tabela recém-criada.
        (supabase as any)
          .from("vitrine_parceiros")
          .select("tipo,ref_id,ordem")
          .eq("ativo", true)
          .order("ordem"),
        supabase.from("global_settings").select("value").eq("key", "vitrine_marquee").maybeSingle(),
      ]);
      if (cancelled) return;

      const rows = (vp ?? []) as { tipo: string; ref_id: string; ordem: number }[];
      const construtoraIds = rows.filter((r) => r.tipo === "construtora").map((r) => r.ref_id);
      const imobIds = rows.filter((r) => r.tipo === "imobiliaria").map((r) => r.ref_id);

      const [cs, ts] = await Promise.all([
        construtoraIds.length
          ? supabase
              .from("construtoras")
              .select("id,slug,nome,logo_url")
              .in("id", construtoraIds)
              .eq("ativo", true)
              .then(({ data }) => data ?? [])
          : Promise.resolve([]),
        imobIds.length
          ? supabase
              .from("tenants")
              .select("id,slug,nome,tema")
              .in("id", imobIds)
              .in("status", ["active", "trial"])
              .then(({ data }) => data ?? [])
          : Promise.resolve([]),
      ]);
      if (cancelled) return;

      const cMap = new Map((cs as { id: string }[]).map((c) => [c.id, c]));
      const tMap = new Map((ts as { id: string }[]).map((t) => [t.id, t]));
      const mapped: VitrineItem[] = [];
      for (const r of rows) {
        if (r.tipo === "construtora") {
          const c = cMap.get(r.ref_id) as
            | { id: string; slug: string; nome: string; logo_url: string | null }
            | undefined;
          if (c)
            mapped.push({
              key: `c-${c.id}`,
              tipo: "construtora",
              slug: c.slug,
              nome: c.nome,
              logoUrl: c.logo_url,
            });
        } else {
          const t = tMap.get(r.ref_id) as
            | { id: string; slug: string; nome: string; tema: unknown }
            | undefined;
          if (t)
            mapped.push({
              key: `i-${t.id}`,
              tipo: "imobiliaria",
              slug: t.slug,
              nome: t.nome,
              logoUrl: (t.tema as { logo_url?: string } | null)?.logo_url ?? null,
            });
        }
      }
      setItens(mapped);

      const s = Number((cfg?.value as { speedSeconds?: number } | null)?.speedSeconds);
      if (s > 0) setSpeed(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (itens.length === 0) return null;

  // Sempre anima (carrossel contínuo). Pra o loop ser suave mesmo com poucos
  // logos, repete a base até ter largura suficiente e duplica esse grupo 2x —
  // o keyframe marquee percorre translateX(-50%), exatamente 1 grupo, sem
  // costura. Antes, com poucos itens, ficava estático (parecia "duplicado" e
  // sem movimento). A velocidade vem de global_settings (super_admin).
  const vezes = Math.max(2, Math.ceil(12 / itens.length));
  const base = Array.from({ length: vezes }, () => itens).flat();
  const track = [...base, ...base];

  return (
    <section className="hero-brand relative isolate overflow-hidden border-t border-border py-12 md:py-14">
      {/* degradê Liquid Glass acinzentado (mesmo dos blocos de parceiros/CTA da home) */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-100 via-zinc-50 to-slate-200/80 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(560px_340px_at_10%_0%,rgba(148,163,184,.22),transparent_70%),radial-gradient(520px_320px_at_92%_100%,rgba(100,116,139,.16),transparent_70%)]" />
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Imobiliárias e Construtoras Parceiras
        </h2>
      </div>
      {/* py-2: espaço para a sombra/hover dos chips de vidro não ser cortado */}
      <div className="mt-8 overflow-hidden py-2">
        <div
          className="flex w-max items-center gap-6"
          style={{ animation: `marquee ${speed}s linear infinite` }}
        >
          {track.map((it, i) => (
            <VitrineChip key={`${it.key}-${i}`} it={it} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Dados legais exibidos no rodapé (credibilidade): razão social, CNPJ e CRECI.
const EMPRESA = {
  razaoSocial: "IMOB365 CORRETAGEM DE IMÓVEIS LTDA",
  cnpj: "41.919.216/0001-32",
  creci: "218052",
};

const REDES_SOCIAIS: { icon: LucideIcon; href: string; label: string }[] = [
  { icon: Facebook, href: "https://www.facebook.com/imob365/", label: "Facebook" },
  { icon: Instagram, href: "https://www.instagram.com/imob365/", label: "Instagram" },
  { icon: Linkedin, href: "https://www.linkedin.com/company/imob365/", label: "LinkedIn" },
];

/**
 * Rodapé único do portal (home e demais páginas públicas) — mesmo design do
 * header "brand": fundo preto, ícones em tile de vidro com ícone laranja e
 * bloco de dados legais (razão social, CNPJ, CRECI) para credibilidade.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="hero-brand border-t border-white/10 bg-black text-[#a1a1a6]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo className="h-9 w-auto" variant="white" />
            <p className="mt-4 text-sm font-medium leading-relaxed">
              A plataforma completa para quem vive de imóveis. Conectamos imobiliárias, corretores e
              clientes em todo o Brasil.
            </p>
            <div className="mt-5 flex gap-2.5">
              {REDES_SOCIAIS.map(({ icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="group transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <IconeVidro icon={icon} />
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
              { label: "Recursos da plataforma", to: "/plataforma", icon: LayoutGrid },
              { label: "Central de Ajuda", to: "/ajuda", icon: BookOpen },
              { label: "Anunciar imóvel", to: "/signup", icon: PlusCircle },
              { label: "Acessar plataforma", to: "/login", icon: Users },
              { label: "Calculadoras", to: "/calculadoras", icon: Calculator, badge: "ITBI" },
            ]}
          />
          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#86868b]">
              Fale com a gente
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  to="/atendimento"
                  className="group flex items-center gap-3 font-semibold text-[#f5f5f7] transition-colors hover:text-[#f4a46a]"
                >
                  <IconeVidro icon={Headset} />
                  Central de Atendimento
                </Link>
              </li>
              <li className="group flex items-center gap-3">
                <IconeVidro icon={HeartHandshake} />
                Suporte 365 dias por ano
              </li>
            </ul>

            {/* Dados legais — credibilidade */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-[#86868b]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#ed7d31]" aria-hidden="true" />
                Empresa registrada
              </div>
              <p className="mt-2 text-xs font-semibold leading-snug text-[#f5f5f7]">
                {EMPRESA.razaoSocial}
              </p>
              <dl className="mt-1.5 space-y-0.5 text-xs">
                <div className="flex gap-1.5">
                  <dt className="text-[#86868b]">CNPJ</dt>
                  <dd className="tabular-nums">{EMPRESA.cnpj}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-[#86868b]">CRECI</dt>
                  <dd className="tabular-nums">{EMPRESA.creci}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs md:flex-row md:items-center">
          <span>
            © {year} imob365 · {EMPRESA.razaoSocial} · CNPJ {EMPRESA.cnpj} · CRECI {EMPRESA.creci}
          </span>
          <div className="flex flex-wrap gap-5">
            {[
              { to: "/termos", label: "Termos de uso" },
              { to: "/privacidade", label: "Política de privacidade" },
              { to: "/lgpd", label: "LGPD" },
              { to: "/status", label: "Status" },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="transition-colors hover:text-white">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

interface FooterLink {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
}

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#86868b]">
        {title}
      </h4>
      <ul className="mt-4 space-y-1.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="group flex items-center gap-3 rounded-xl py-0.5 transition-colors hover:text-white"
            >
              <IconeVidro icon={l.icon} />
              <span>{l.label}</span>
              {l.badge && (
                <span className="rounded-full border border-[#ed7d31]/35 bg-[#ed7d31]/15 px-1.5 py-px text-[8px] font-black uppercase tracking-widest text-[#f4a46a]">
                  {l.badge}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
