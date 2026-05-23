import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { SiteHeader, SiteFooter } from "@/routes/index";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos e preços — imob365" },
      { name: "description", content: "Escolha o plano ideal para sua imobiliária. Planos a partir de R$ 99/mês, com módulos plugáveis e cota flexível." },
      { property: "og:title", content: "Planos e preços — imob365" },
      { property: "og:description", content: "Planos modulares para imobiliárias de todos os tamanhos." },
    ],
  }),
  component: PlanosPage,
});

type Plan = {
  id: string;
  nome: string;
  preco_mensal: number;
  limites: { imoveis?: number; modulos?: number; usuarios?: number } | null;
};

const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  Basic: [
    "Catálogo público com SEO",
    "CRM de leads e funil",
    "Gestão de corretores",
    "Suporte por e-mail",
  ],
  Standard: [
    "Tudo do Basic",
    "Integração com portais (VivaReal, ZAP, OLX)",
    "Jurídico com modelos de contrato",
    "Suporte prioritário",
  ],
  Pro: [
    "Tudo do Standard",
    "Financeiro completo",
    "Campos customizados e CMS",
    "Webhooks e API pública",
  ],
  Business: [
    "Tudo do Pro",
    "White-label completo",
    "Módulos ilimitados",
    "Suporte dedicado + SLA",
  ],
};

function PlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("plans")
        .select("id,nome,preco_mensal,limites")
        .order("preco_mensal", { ascending: true });
      setPlans((data as Plan[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const destaqueIdx = plans.findIndex((p) => p.nome === "Standard");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

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
            Todos os planos incluem os módulos essenciais (Catálogo, CRM, Corretores). Você ativa apenas os módulos opcionais que precisar — dentro da cota do seu plano.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[420px] animate-pulse rounded-xl border border-border bg-card" />
          ))}
          {!loading && plans.map((p, i) => {
            const highlights = PLAN_HIGHLIGHTS[p.nome] ?? [];
            const cotaModulos = p.limites?.modulos ?? 0;
            const cotaText = cotaModulos === -1 ? "Ilimitados" : `${cotaModulos} módulos opcionais`;
            const destaque = i === destaqueIdx;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-xl border bg-card p-6 shadow-sm transition ${destaque ? "border-primary shadow-lg ring-1 ring-primary/40" : "border-border"}`}
              >
                {destaque && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> Mais popular
                  </span>
                )}
                <h3 className="text-lg font-semibold">{p.nome}</h3>
                <div className="mt-3">
                  <span className="text-4xl font-bold tracking-tight">{formatBRL(p.preco_mensal)}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Até {p.limites?.imoveis?.toLocaleString("pt-BR")} imóveis</li>
                  <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p.limites?.usuarios} usuários</li>
                  <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {cotaText}</li>
                  {highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {h}</li>
                  ))}
                </ul>
                <div className="mt-6 flex-1" />
                <Link to="/app/contratacao" search={{ plano_id: p.id }} className="mt-4">
                  <Button className={`w-full ${destaque ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`} variant={destaque ? "default" : "outline"}>
                    Começar com {p.nome}
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-16 rounded-xl border border-border bg-muted/30 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Precisa de algo sob medida?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Para redes de imobiliárias, franquias ou volumes maiores temos planos Enterprise com SLA dedicado, integrações sob medida e hospedagem na sua infraestrutura.
          </p>
          <a href="mailto:contato@imob365.com.br" className="mt-4 inline-block">
            <Button variant="outline">Falar com vendas</Button>
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}