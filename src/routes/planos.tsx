import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import {
  Check,
  Minus,
  Sparkles,
  MessageSquare,
  UserPlus,
  Gift,
  LayoutGrid,
  TrendingUp,
  Settings2,
  CreditCard,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { useAuth } from "@/hooks/useAuth";
import { seoHead, getSeoConfig } from "@/lib/seo";

type PlanRow = {
  slug: string;
  nome: string;
  preco_mensal: number;
  preco_anual: number | null;
  limites: { imoveis?: number; usuarios?: number } | null;
};

const PLAN_ORDER = ["free", "basic", "standard", "pro", "business"];

const fetchActivePlans = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabase
    .from("plans")
    .select("slug,nome,preco_mensal,preco_anual,limites")
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  const rows = (data as unknown as PlanRow[]) ?? [];
  // Business tem preco_mensal=0 (placeholder de "sob consulta"), então ordenar por preço
  // empataria com Free — a ordem de exibição segue PLAN_ORDER, não preço.
  rows.sort((a, b) => PLAN_ORDER.indexOf(a.slug) - PLAN_ORDER.indexOf(b.slug));
  return rows;
});

export const Route = createFileRoute("/planos")({
  loader: async () => fetchActivePlans(),
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/planos",
      title: "Planos e preços — imob365",
      description:
        "Escolha o plano ideal para sua imobiliária. De gratuito a Business, com módulos plugáveis para imobiliárias de todos os tamanhos.",
    }),
  component: PlanosPage,
});

type BillingCycle = "monthly" | "annual";

// Conteúdo de marketing por plano — não vem do banco (plans só guarda preço/limites/módulos).
const MARKETING: Record<
  string,
  { highlight?: boolean; enterprise?: boolean; isContact?: boolean; features: string[] }
> = {
  free: {
    features: [
      "Catálogo básico de imóveis",
      "CRM simplificado de leads",
      "1 usuário",
      "Site público básico",
      "E-Learning (acesso TTI)",
    ],
  },
  basic: {
    features: [
      "Catálogo completo com SEO",
      "CRM de leads e funil Kanban",
      "Branding / site imobiliária",
      "E-Learning (acesso TTI)",
      "Suporte por e-mail",
    ],
  },
  standard: {
    highlight: true,
    features: [
      "Tudo do Basic",
      "Marketing: VivaReal, ZAP, OLX",
      "Jurídico: modelos de contrato",
      "E-Learning completo",
      "Suporte prioritário",
    ],
  },
  pro: {
    features: [
      "Tudo do Standard",
      "Financeiro completo (comissões, DRE)",
      "Jurídico: assinatura digital",
      "API pública e webhooks",
    ],
  },
  business: {
    enterprise: true,
    isContact: true,
    features: [
      "Imóveis e usuários ilimitados",
      "Todos os módulos habilitados",
      "E-Learning ilimitado + cursos exclusivos",
      "White-label completo",
      "Suporte dedicado + SLA",
    ],
  },
};

const MODULE_MATRIX: { label: string; values: [string, string, string, string, string] }[] = [
  { label: "Imóveis (básico)", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Imóveis (completo + agenda)", values: ["—", "✓", "✓", "✓", "✓"] },
  { label: "CRM de leads", values: ["Simpl.", "✓", "✓", "✓", "✓"] },
  { label: "Branding / site público", values: ["Básico", "✓", "✓", "✓", "✓"] },
  { label: "Marketing (portais + blog)", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "E-Learning", values: ["TTI", "TTI", "✓", "✓", "Ilimitado"] },
  { label: "Financeiro", values: ["—", "—", "—", "✓", "✓"] },
  { label: "Jurídico (modelos)", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "Jurídico (assinatura digital)", values: ["—", "—", "—", "✓", "✓"] },
  { label: "API / Webhooks", values: ["—", "—", "—", "✓", "✓"] },
  {
    label: "Segurança & Compliance (LGPD, auditoria)",
    values: ["✓", "✓", "✓", "✓", "✓"],
  },
  { label: "Suporte", values: ["E-mail", "E-mail", "Prioritário", "Prioritário", "Dedicado+SLA"] },
  {
    label: "Assistente de IA",
    values: ["2/2h", "2/2h", "2/2h", "Ilimitado", "Ilimitado"],
  },
];

const ETAPAS_TOPO = [
  { icon: UserPlus, titulo: "Crie a conta" },
  { icon: Gift, titulo: "Teste 30 dias" },
  { icon: LayoutGrid, titulo: "Escolha o plano" },
  { icon: TrendingUp, titulo: "Cresça" },
];

const FLUXO_CONTRATACAO: Etapa[] = [
  { icon: UserPlus, titulo: "Crie a conta", texto: "Corretor ou imobiliária" },
  { icon: Gift, titulo: "30 dias de Business", texto: "Todos os módulos liberados" },
  { icon: CreditCard, titulo: "Escolha o plano", texto: "Mensal ou anual" },
  { icon: Settings2, titulo: "Ative módulos", texto: "Só o que precisar" },
];

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PlanosPage() {
  const plans = Route.useLoaderData();
  const { user, tenantId } = useAuth();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("tenants")
      .select("plano_slug")
      .eq("id", tenantId)
      .maybeSingle()
      .then(({ data }) => setCurrentPlanSlug(data?.plano_slug ?? null));
  }, [tenantId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Um único bloco SoftwareApplication (não Product por card): semanticamente
          correto pra assinatura SaaS e com o campo image obrigatório — a
          auditoria GSC apontou os Product sem image (sem rich results). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "imob365",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            image: "https://portal.imob365.com.br/icon-512.png",
            description:
              "Plataforma SaaS all-in-one para imobiliárias e corretores: catálogo de imóveis, CRM, financeiro, jurídico, marketing e e-learning.",
            offers: plans
              .filter((p) => p.preco_mensal > 0)
              .map((p) => ({
                "@type": "Offer",
                name: `Plano ${p.nome}`,
                price: p.preco_mensal,
                priceCurrency: "BRL",
                availability: "https://schema.org/InStock",
              })),
          }),
        }}
      />
      <SiteHeader />

      <PaginaGlass>
        <HeroGlass
          selo="Planos e preços"
          titulo="Escolha o plano ideal"
          destaque="para sua imobiliária."
          subtitulo="Do cadastro básico ao financeiro, jurídico e marketing integrado — ative apenas o que precisar, no ritmo do seu negócio. Planos modulares, cancele quando quiser."
        >
          <FaixaEtapas etapas={ETAPAS_TOPO} rotulo="Como contratar" />
          <div>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-white/10">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className={`rounded-full px-6 py-2 text-sm font-bold transition-colors ${
                  billing === "monthly"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setBilling("annual")}
                className={`flex items-center gap-2 rounded-full px-6 py-2 text-sm font-bold transition-colors ${
                  billing === "annual"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Anual
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    billing === "annual"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  −12%
                </span>
              </button>
            </div>
            {billing === "annual" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Equivale a 2 meses grátis — cobrança única anual
              </p>
            )}
          </div>
        </HeroGlass>

        {/* Plan cards */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-7xl gap-5 pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {plans.map((p) => {
              const marketing = MARKETING[p.slug] ?? { features: [] };
              const isCurrent = currentPlanSlug === p.slug;
              const isContact = !!marketing.isContact;
              const maxImoveis = p.limites?.imoveis ?? 0;
              const maxUsuarios = p.limites?.usuarios ?? 0;
              const displayMonthly =
                billing === "annual" && p.preco_anual && p.preco_anual > 0
                  ? p.preco_anual / 12
                  : p.preco_mensal;

              return (
                <div
                  key={p.slug}
                  className={`${CARD_GLASS} relative flex flex-col p-5 transition ${
                    marketing.highlight
                      ? "border-primary/60 ring-1 ring-primary/40 xl:scale-[1.02]"
                      : isCurrent
                        ? "border-emerald-500 ring-1 ring-emerald-500/30"
                        : ""
                  }`}
                >
                  {/* Top badge */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex gap-1 whitespace-nowrap">
                    {marketing.highlight && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        <Sparkles className="h-3 w-3" /> Mais popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                        Plano atual
                      </span>
                    )}
                    {marketing.enterprise && !isCurrent && (
                      <span className="inline-flex items-center rounded-full bg-[#0f1e3a] px-3 py-1 text-xs font-semibold text-white">
                        Enterprise
                      </span>
                    )}
                  </div>

                  <h3 className="font-brand-display text-lg font-extrabold">{p.nome}</h3>

                  {/* Price block */}
                  <div className="mt-3 min-h-[4rem]">
                    {isContact ? (
                      <p className="text-2xl font-bold">Sob consulta</p>
                    ) : displayMonthly === 0 ? (
                      <p className="text-3xl font-extrabold tracking-tight">Grátis</p>
                    ) : (
                      <>
                        <p className="text-3xl font-extrabold tracking-tight">
                          {fmtBRL(displayMonthly)}
                          <span className="text-sm font-normal text-muted-foreground">/mês</span>
                        </p>
                        {billing === "annual" && p.preco_anual && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {fmtBRL(p.preco_anual)} cobrado anualmente
                          </p>
                        )}
                        {billing === "monthly" && p.preco_anual ? (
                          <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                            ou {fmtBRL(p.preco_anual / 12)}/mês no plano anual
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="mt-4 space-y-1 border-t border-black/5 pt-3 text-xs text-muted-foreground dark:border-white/10">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {maxImoveis === -1 ? "Imóveis ilimitados" : `Até ${maxImoveis} imóveis`}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {maxUsuarios === -1
                        ? "Usuários ilimitados"
                        : `${maxUsuarios} usuário${maxUsuarios > 1 ? "s" : ""}`}
                    </div>
                  </div>

                  {/* Feature list */}
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {marketing.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="flex-1" />

                  {/* CTA */}
                  <div className="mt-6">
                    {isCurrent ? (
                      <Link to="/app/contratacao">
                        <Button
                          variant="outline"
                          className="w-full rounded-full border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        >
                          Gerenciar assinatura
                        </Button>
                      </Link>
                    ) : isContact ? (
                      <a href="mailto:contato@imob365.com.br">
                        <Button className="w-full rounded-full bg-[#0f1e3a] text-white hover:bg-[#1b2f57]">
                          <MessageSquare className="mr-2 h-3.5 w-3.5" /> Falar com vendas
                        </Button>
                      </a>
                    ) : p.slug === "free" ? (
                      <Link to={user ? "/app" : "/signup"}>
                        <Button variant="outline" className="w-full rounded-full">
                          {user ? "Acessar painel" : "Começar grátis"}
                        </Button>
                      </Link>
                    ) : (
                      <Link
                        to={user ? "/app/contratacao" : "/signup"}
                        search={!user ? { plano: p.slug } : undefined}
                      >
                        <Button
                          className="w-full rounded-full"
                          variant={marketing.highlight ? "default" : "outline"}
                        >
                          {user ? "Fazer upgrade" : `Assinar ${p.nome}`}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Como funciona a contratação: texto 50% + fluxograma 50% */}
        <section className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Como funciona</span>
              <h2 className={TITULO_SECAO}>Comece com tudo liberado</h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                Ao criar a conta, você usa o plano Business com todos os módulos por 30 dias.
                Depois, escolhe o plano que faz sentido e ativa só os módulos que precisar — dá para
                mudar quando quiser.
              </p>
              <Link
                to={user ? "/app" : "/signup"}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
              >
                {user ? "Acessar painel" : "Começar agora"}
              </Link>
            </div>
            <Fluxograma
              titulo="Contratação da plataforma"
              legenda="Fluxo de contratação"
              etapas={FLUXO_CONTRATACAO}
              resultado="Plataforma do tamanho do seu negócio"
            />
          </div>
        </section>

        {/* Comparativo de módulos */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 space-y-2 text-center">
              <span className={SELO}>Comparativo</span>
              <h2 className={TITULO_SECAO}>Comparativo de módulos</h2>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                Recursos bloqueados aparecem com cadeado no painel — nunca ocultos — para facilitar
                o upgrade quando precisar.
              </p>
            </div>

            <div className={`${CARD_GLASS} overflow-x-auto`}>
              <table className="w-full text-sm">
                <thead className="bg-white/60 dark:bg-white/5">
                  <tr>
                    <th className="w-52 px-4 py-3 text-left text-xs font-bold text-muted-foreground">
                      Módulo / recurso
                    </th>
                    {plans.map((p) => (
                      <th
                        key={p.slug}
                        className={`px-4 py-3 text-center text-xs font-bold ${
                          MARKETING[p.slug]?.highlight ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {p.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULE_MATRIX.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-t border-black/5 dark:border-white/10 ${i % 2 === 0 ? "" : "bg-white/40 dark:bg-white/5"}`}
                    >
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{row.label}</td>
                      {row.values.map((val, j) => (
                        <td key={j} className="px-4 py-2.5 text-center">
                          {val === "✓" ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-500" />
                          ) : val === "—" ? (
                            <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" />
                          ) : (
                            <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {val}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Sob medida (branco, 50%) */}
        <section className={BLOCO_BRANCO}>
          <div
            className={`${CARD_GLASS} mx-auto grid max-w-6xl items-center gap-4 p-6 md:grid-cols-2 md:p-8`}
          >
            <div>
              <h2 className="font-brand-display text-xl font-extrabold tracking-tight">
                Precisa de algo sob medida?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Para redes de imobiliárias, franquias ou volumes maiores: SLA dedicado, integrações
                customizadas, onboarding guiado e hospedagem na sua infraestrutura.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <a
                href="mailto:contato@imob365.com.br"
                className="inline-flex items-center gap-2 rounded-full bg-[#0f1e3a] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1b2f57]"
              >
                <MessageSquare className="h-4 w-4" /> Falar com vendas
              </a>
              <Link
                to="/contato"
                className="glass-claro inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition hover:bg-white/60"
              >
                Página de contato
              </Link>
            </div>
          </div>
        </section>
      </PaginaGlass>

      <SiteFooter />
    </div>
  );
}
