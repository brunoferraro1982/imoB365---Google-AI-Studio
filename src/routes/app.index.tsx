import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Users, FileText, Banknote, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/app/")({
  component: AppDashboard,
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

function AppDashboard() {
  const { tenantId } = useAuth();
  const [k, setK] = useState<KPIs>({ imoveisAtivos: 0, leadsFunil: 0, contratosAbertos: 0, recebimentosMes: 0 });
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [im, lf, ct, lr, recent] = await Promise.all([
        supabase.from("imoveis").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "ativo"),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).not("status", "in", "(ganho,perdido)"),
        supabase.from("contratos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["rascunho", "ativo"]),
        supabase.from("lancamentos_financeiros").select("valor").eq("tenant_id", tenantId).eq("tipo", "receita").eq("status", "pago").gte("data_pagamento", inicioMes.toISOString().slice(0, 10)),
        supabase.from("leads").select("id,nome,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(5),
      ]);

      const total = (lr.data ?? []).reduce((s: number, r: any) => s + Number(r.valor ?? 0), 0);
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
    { label: "Imóveis ativos", value: String(k.imoveisAtivos), icon: Building2, to: "/app/imoveis" },
    { label: "Leads no funil", value: String(k.leadsFunil), icon: Users, to: "/app/leads" },
    { label: "Contratos abertos", value: String(k.contratosAbertos), icon: FileText, to: "/app/contratos" },
    { label: "Recebimentos do mês", value: formatBRL(k.recebimentosMes), icon: Banknote, to: "/app/financeiro" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span>Painel de gestão</span>
        </div>
        <h1 className="text-3.5xl font-black tracking-tight text-foreground mt-1">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground/90">Visão geral em tempo real da sua imobiliária imob365.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link 
            key={s.label} 
            to={s.to} 
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-[var(--shadow-elegant)] hover:border-primary/30 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</span>
                <div className="text-3xl font-black tracking-tight text-foreground pt-1">
                  {loading ? (
                    <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
                  ) : s.value}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-primary/8 text-primary group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                <s.icon className="h-5 w-5 stroke-[2.25px]" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-glow transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-8 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-border/80">
            <div>
              <h2 className="font-bold text-lg text-foreground">Leads recentes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Últimas oportunidades de negócios registradas.</p>
            </div>
            <Link to="/app/leads" className="inline-flex items-center text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-all">
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border/65 text-sm">
            {leads.length === 0 && (
              <li className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Users className="h-8 w-8 text-muted-foreground/40" />
                <span>Nenhum lead encontrado ainda.</span>
              </li>
            )}
            {leads.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-3.5 hover:bg-muted/10 px-2 rounded-lg transition-colors">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground text-sm">{l.nome}</p>
                  <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold leading-none tracking-wide text-center uppercase ${
                  l.status === "novo" 
                    ? "bg-blue-100/85 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : l.status === "contatado"
                    ? "bg-yellow-100/85 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                    : l.status === "proposta"
                    ? "bg-purple-100/85 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {l.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-4 shadow-sm space-y-5">
          <div>
            <h2 className="font-bold text-lg text-foreground">Ações rápidas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Atalhos para tarefas rápidas do dia a dia.</p>
          </div>
          <div className="grid grid-cols-1 gap-2.5 text-sm">
            <Link to="/app/imoveis/novo" className="flex items-center justify-between rounded-xl border border-border/85 bg-background hover:bg-primary/5 hover:border-primary/40 px-4 py-3.5 text-foreground font-semibold group transition-all duration-200">
              <span>+ Cadastrar imóvel</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
            <Link to="/app/contratos/novo" className="flex items-center justify-between rounded-xl border border-border/85 bg-background hover:bg-primary/5 hover:border-primary/40 px-4 py-3.5 text-foreground font-semibold group transition-all duration-200">
              <span>+ Criar contrato</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
            <Link to="/app/corretores/novo" className="flex items-center justify-between rounded-xl border border-border/85 bg-background hover:bg-primary/5 hover:border-primary/40 px-4 py-3.5 text-foreground font-semibold group transition-all duration-200">
              <span>+ Adicionar corretor</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
            <Link to="/app/financeiro/novo" className="flex items-center justify-between rounded-xl border border-border/85 bg-background hover:bg-primary/5 hover:border-primary/40 px-4 py-3.5 text-foreground font-semibold group transition-all duration-200">
              <span>+ Novo lançamento</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}