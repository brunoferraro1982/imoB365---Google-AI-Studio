import { moduleGuard } from "@/lib/routeGuard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { verificarSlaContratos } from "@/lib/slaAlertas.functions";
import { CONTRATO_VENCIMENTO_DIAS } from "@/lib/slaAlertas";
import { TIPO_LABEL } from "@/lib/contratosLabels";

export const Route = createFileRoute("/app/contratos/painel")({
  beforeLoad: moduleGuard("juridico"),
  component: PainelContratosPage,
});

type ContratoResumo = {
  id: string;
  numero: string | null;
  tipo: string;
  status: string;
  data_fim: string | null;
  corretor_id: string | null;
  corretor: { nome: string | null } | null;
};

function diasRestantes(dataFim: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(`${dataFim}T00:00:00`);
  return Math.round((fim.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));
}

function StatTile({
  label,
  value,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: number;
  tone?: "critical" | "serious" | "warning" | "neutral";
  icon?: typeof AlertTriangle;
}) {
  const toneClass = {
    critical: "text-rose-600",
    serious: "text-orange-600",
    warning: "text-amber-600",
    neutral: "text-foreground",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function PainelContratosPage() {
  const { tenantId } = useAuth();
  const [contratos, setContratos] = useState<ContratoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    // Sem FK real entre contratos.corretor_id e corretores.id no banco, o
    // PostgREST não resolve join aninhado (corretor:corretores(...)) —
    // busca-se separadamente e faz-se o merge no cliente.
    const [{ data: contratosData, error }, { data: corretoresData }] = await Promise.all([
      supabase
        .from("contratos")
        .select("id,numero,tipo,status,data_fim,corretor_id")
        .order("data_fim", { ascending: true, nullsFirst: false }),
      supabase.from("corretores").select("id,nome"),
    ]);
    if (error) toast.error(error.message);
    const nomesPorCorretor = new Map(
      (corretoresData ?? []).map((c: { id: string; nome: string }) => [c.id, c.nome]),
    );
    const merged = (contratosData ?? []).map((c: any) => ({
      ...c,
      corretor: c.corretor_id ? { nome: nomesPorCorretor.get(c.corretor_id) ?? null } : null,
    }));
    setContratos(merged as ContratoResumo[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  async function verificarSla() {
    setVerificando(true);
    try {
      const r = await verificarSlaContratos();
      toast.success(
        `Verificação concluída: ${r.contratosAlertados} contrato(s) e ${r.cartoriosAlertados} cartório(s) alertados`,
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao verificar SLA");
    } finally {
      setVerificando(false);
    }
  }

  const ativos = contratos.filter((c) => c.status === "ativo");
  const comVencimento = ativos.filter((c) => c.data_fim);
  const vencidos = comVencimento.filter((c) => diasRestantes(c.data_fim!) < 0);
  const ate30 = comVencimento.filter((c) => {
    const d = diasRestantes(c.data_fim!);
    return d >= 0 && d <= 30;
  });
  const de31a60 = comVencimento.filter((c) => {
    const d = diasRestantes(c.data_fim!);
    return d > 30 && d <= 60;
  });
  const de61a90 = comVencimento.filter((c) => {
    const d = diasRestantes(c.data_fim!);
    return d > 60 && d <= 90;
  });

  const porTipo = Object.keys(TIPO_LABEL)
    .map((tipo) => ({ tipo, total: ativos.filter((c) => c.tipo === tipo).length }))
    .filter((t) => t.total > 0);

  const aVencerLista = [...vencidos, ...ate30, ...de31a60, ...de61a90].sort((a, b) =>
    a.data_fim! < b.data_fim! ? -1 : 1,
  );

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Painel de Contratos</h1>
            <p className="text-sm text-muted-foreground">
              Visão geral de contratos ativos, vencimentos e SLA de cartórios.
            </p>
          </div>
        </div>
        <Button onClick={verificarSla} disabled={verificando} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${verificando ? "animate-spin" : ""}`} />
          {verificando ? "Verificando…" : "Verificar SLA agora"}
        </Button>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Ativos" value={ativos.length} />
        <StatTile label="Vencidos" value={vencidos.length} tone="critical" icon={AlertTriangle} />
        <StatTile label="Vence em até 30 dias" value={ate30.length} tone="serious" />
        <StatTile label="31–60 dias" value={de31a60.length} tone="warning" />
        <StatTile label="61–90 dias" value={de61a90.length} tone="neutral" />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Contratos ativos por tipo
        </h2>
        <div className="flex flex-wrap gap-2">
          {porTipo.map((t) => (
            <Badge key={t.tipo} variant="outline" className="px-3 py-1 text-sm">
              {TIPO_LABEL[t.tipo]}: <span className="ml-1 font-semibold">{t.total}</span>
            </Badge>
          ))}
          {porTipo.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum contrato ativo.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Contratos a vencer (próximos {CONTRATO_VENCIMENTO_DIAS} dias) e vencidos
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : aVencerLista.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum contrato ativo com vencimento próximo.
          </p>
        ) : (
          <div className="space-y-2">
            {aVencerLista.map((c) => {
              const dias = diasRestantes(c.data_fim!);
              return (
                <Link
                  key={c.id}
                  to="/app/contratos/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 text-sm hover:border-primary/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.numero ? `#${c.numero}` : "Contrato"}</span>
                      <Badge variant="secondary" className="capitalize">
                        {TIPO_LABEL[c.tipo] ?? c.tipo}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {c.corretor?.nome ?? "Sem corretor"} · Vencimento{" "}
                      {new Date(`${c.data_fim}T00:00:00`).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <Badge
                    className={
                      dias < 0
                        ? "bg-rose-600"
                        : dias <= 30
                          ? "bg-orange-500"
                          : dias <= 60
                            ? "bg-amber-500"
                            : "bg-sky-500"
                    }
                  >
                    {dias < 0 ? `${Math.abs(dias)}d vencido` : `${dias}d restantes`}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
