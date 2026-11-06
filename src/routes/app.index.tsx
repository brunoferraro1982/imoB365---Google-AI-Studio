import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Users, FileText, Banknote, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/format";
import { modulosVisiveis } from "@/components/layout/navConfig";
import { SELO, TITULO_SECAO } from "@/components/portal/PaginaGlass";

export const Route = createFileRoute("/app/")({
  component: AppPainel,
});

type KPIs = {
  imoveisAtivos: number;
  leadsFunil: number;
  contratosAbertos: number;
  recebimentosMes: number;
};

type LeadRow = {
  id: string;
  nome: string;
  status: string;
  created_at: string;
};

// Painel inicial em liquid glass: é o "Dashboards" do menu Início.
// Reúne o painel de gestão (KPIs e leads) e widgets de cada módulo do plano.
function AppPainel() {
  const { tenantId, profile, roles, enabledModules, isSuperAdmin } = useAuth();
  const [k, setK] = useState<KPIs>({
    imoveisAtivos: 0,
    leadsFunil: 0,
    contratosAbertos: 0,
    recebimentosMes: 0,
  });
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const modulos = useMemo(
    () =>
      modulosVisiveis({ roles, enabledModules, isSuperAdmin }).filter((m) => m.id !== "dashboard"),
    [roles, enabledModules, isSuperAdmin],
  );

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [im, lf, ct, lr, recent] = await Promise.all([
        supabase
          .from("imoveis")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "ativo"),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("status", "in", "(ganho,perdido)"),
        supabase
          .from("contratos")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .in("status", ["rascunho", "ativo"]),
        supabase
          .from("lancamentos_financeiros")
          .select("valor")
          .eq("tenant_id", tenantId)
          .eq("tipo", "receita")
          .eq("status", "pago")
          .gte("data_pagamento", inicioMes.toISOString().slice(0, 10)),
        supabase
          .from("leads")
          .select("id,nome,status,created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const total = (lr.data ?? []).reduce(
        (s: number, r: { valor: number | string | null }) => s + Number(r.valor ?? 0),
        0,
      );
      setK({
        imoveisAtivos: im.count ?? 0,
        leadsFunil: lf.count ?? 0,
        contratosAbertos: ct.count ?? 0,
        recebimentosMes: total,
      });
      setLeads((recent.data as LeadRow[]) ?? []);
      setLoading(false);
    })();
  }, [tenantId]);

  const stats = [
    {
      label: "Imóveis ativos",
      value: String(k.imoveisAtivos),
      icon: Building2,
      to: "/app/imoveis",
    },
    { label: "Leads no funil", value: String(k.leadsFunil), icon: Users, to: "/app/leads" },
    {
      label: "Contratos abertos",
      value: String(k.contratosAbertos),
      icon: FileText,
      to: "/app/contratos",
    },
    {
      label: "Recebimentos do mês",
      value: formatBRL(k.recebimentosMes),
      icon: Banknote,
      to: "/app/financeiro",
    },
  ];

  const primeiroNome = (profile?.nome ?? "").trim().split(" ")[0];

  return (
    <div className="mesh-brand-claro min-h-full">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <section className="glass-fosco rounded-3xl border border-white/40 p-6 md:p-8">
          <span className={SELO}>Painel</span>
          <h1 className={`${TITULO_SECAO} mt-3`}>
            {primeiroNome ? `Olá, ${primeiroNome}` : "Olá"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua imobiliária, seus módulos e seus números em um só lugar.
          </p>
        </section>

        <section className="space-y-3">
          <span className={SELO}>Painel de gestão</span>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Link
                key={s.label}
                to={s.to}
                className="glass-fosco group relative overflow-hidden rounded-2xl border border-white/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </span>
                    <div className="pt-1 text-2xl font-black tracking-tight text-foreground md:text-3xl">
                      {loading ? (
                        <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
                      ) : (
                        s.value
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary transition-all group-hover:bg-primary/20">
                    <s.icon className="h-5 w-5 stroke-[2.25px]" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <span className={SELO}>Seus módulos</span>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((m) => (
              <Link
                key={m.id}
                to={m.items[0].to}
                className={
                  m.destaque
                    ? "group rounded-2xl bg-primary p-5 font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:-translate-y-1 hover:bg-primary/90"
                    : "glass-fosco group rounded-2xl border border-white/40 p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
                }
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl p-2.5 ${m.destaque ? "bg-white/20" : "bg-primary/10 text-primary"}`}
                  >
                    <m.icon className="h-5 w-5 stroke-[2.25px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-base ${m.destaque ? "font-extrabold" : "font-bold text-foreground"}`}
                    >
                      {m.label}
                    </p>
                    <p
                      className={`truncate text-xs ${m.destaque ? "text-primary-foreground/85" : "text-muted-foreground"}`}
                    >
                      {m.items.map((i) => i.label).join(" · ")}
                    </p>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 ${m.destaque ? "" : "text-muted-foreground"}`}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="glass-fosco rounded-3xl border border-white/40 p-6 lg:col-span-8">
            <div className="flex items-center justify-between border-b border-border/70 pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Leads recentes</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Últimas oportunidades registradas.
                </p>
              </div>
              <Link
                to="/app/leads"
                className="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="mt-2 divide-y divide-border/60 text-sm">
              {leads.length === 0 && (
                <li className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                  <span>Nenhum lead encontrado ainda.</span>
                </li>
              )}
              {leads.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-2 py-3.5">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {l.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-fosco space-y-3 rounded-3xl border border-white/40 p-6 lg:col-span-4">
            <h2 className="text-lg font-bold text-foreground">Ações rápidas</h2>
            {[
              { to: "/app/imoveis/novo", label: "Cadastrar imóvel" },
              { to: "/app/contratos/novo", label: "Criar contrato" },
              { to: "/app/corretores/novo", label: "Adicionar corretor" },
              { to: "/app/financeiro/novo", label: "Novo lançamento" },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group flex items-center justify-between rounded-xl border border-border/80 bg-background/70 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span>+ {a.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
