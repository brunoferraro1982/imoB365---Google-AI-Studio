import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { Check, Minus, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { useAuth } from "@/hooks/useAuth";

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
  head: () => ({
    meta: [
      { title: "Planos e preços — imob365" },
      {
        name: "description",
        content:
          "Escolha o plano ideal para sua imobiliária. De gratuito a Business, com módulos plugáveis para imobiliárias de todos os tamanhos.",
      },
      { property: "og:title", content: "Planos e preços — imob365" },
      {
        property: "og:description",
        content:
          "Planos modulares para imobiliárias de todos os tamanhos. A partir de R$ 99,90/mês.",
      },
    ],
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
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,_var(--primary)_18%,_transparent),_transparent_60%)]" />
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24 text-center">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Planos modulares · cancele quando quiser
          </span>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Escolha o plano ideal para <span className="text-primary">sua imobiliária</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Do cadastro básico ao financeiro, jurídico e marketing integrado — ative apenas o que
            precisar, no ritmo do seu negócio.
          </p>

          {/* Billing toggle */}
          <div className="mt-10 inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
            <button
              onClick={() => setBilling("monthly")}
              className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
                billing === "monthly"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
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
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                className={`relative flex flex-col rounded-xl border bg-card p-5 shadow-sm transition ${
                  marketing.highlight
                    ? "border-primary shadow-lg ring-1 ring-primary/40 xl:scale-[1.02]"
                    : isCurrent
                      ? "border-emerald-500 ring-1 ring-emerald-500/30"
                      : "border-border"
                }`}
              >
                {!isContact && (
                  <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                      __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Product",
                        name: `imob365 — Plano ${p.nome}`,
                        offers: {
                          "@type": "Offer",
                          price: p.preco_mensal,
                          priceCurrency: "BRL",
                          availability: "https://schema.org/InStock",
                        },
                      }),
                    }}
                  />
                )}
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
                    <span className="inline-flex items-center rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">
                      Enterprise
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-semibold">{p.nome}</h3>

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
                <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
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
                        className="w-full border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      >
                        Gerenciar assinatura
                      </Button>
                    </Link>
                  ) : isContact ? (
                    <a href="mailto:contato@imob365.com.br">
                      <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                        <MessageSquare className="mr-2 h-3.5 w-3.5" /> Falar com vendas
                      </Button>
                    </a>
                  ) : p.slug === "free" ? (
                    <Link to={user ? "/app" : "/signup"}>
                      <Button variant="outline" className="w-full">
                        {user ? "Acessar painel" : "Começar grátis"}
                      </Button>
                    </Link>
                  ) : (
                    <Link
                      to={user ? "/app/contratacao" : "/signup"}
                      search={!user ? { plano: p.slug } : undefined}
                    >
                      <Button
                        className="w-full"
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

      {/* Module comparison table */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
        <h2 className="text-center text-2xl font-bold tracking-tight">Comparativo de módulos</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
          Recursos bloqueados aparecem com cadeado no painel — nunca ocultos — para facilitar o
          upgrade quando precisar.
        </p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-52">
                  Módulo / Recurso
                </th>
                {plans.map((p) => (
                  <th
                    key={p.slug}
                    className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide ${
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
                  className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/20"}`}
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
      </section>

      {/* Enterprise banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-background p-10 text-center dark:border-violet-800 dark:from-violet-950/30">
          <h2 className="text-2xl font-bold tracking-tight">Precisa de algo sob medida?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Para redes de imobiliárias, franquias ou volumes maiores: SLA dedicado, integrações
            customizadas, onboarding guiado e hospedagem na sua infraestrutura.
          </p>
          <a href="mailto:contato@imob365.com.br" className="mt-6 inline-block">
            <Button className="bg-violet-600 hover:bg-violet-700 text-white">
              <MessageSquare className="mr-2 h-4 w-4" /> Falar com vendas
            </Button>
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
