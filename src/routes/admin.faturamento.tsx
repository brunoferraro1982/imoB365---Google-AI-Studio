import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  TrendingUp,
  Users,
  AlertTriangle,
  Ban,
  XCircle,
  Gift,
  Clock,
  UserCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getAdminFaturamento } from "@/lib/admin-faturamento.functions";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/faturamento")({
  component: AdminFaturamentoPage,
});

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-rose-600"
        : tone === "warning"
          ? "text-amber-600"
          : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const statusColor: Record<string, string> = {
  trial: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30",
  active: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30",
  suspended: "text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-900/30",
  cancelled: "text-muted-foreground bg-muted",
};

const paymentStatusColor: Record<string, string> = {
  none: "text-muted-foreground bg-muted",
  pending: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30",
  authorized: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30",
  paused: "text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-900/30",
  cancelled: "text-muted-foreground bg-muted",
};

const paymentStatusLabel: Record<string, string> = {
  none: "Sem cobrança",
  pending: "Pendente",
  authorized: "Em dia",
  paused: "Inadimplente",
  cancelled: "Cancelada",
};

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${className}`}
    >
      {label}
    </span>
  );
}

function AdminFaturamentoPage() {
  const fetchFn = useServerFn(getAdminFaturamento);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-faturamento"],
    queryFn: () => fetchFn(),
  });

  async function toggleTenantStatus(tenantId: string, current: string) {
    const next = current === "suspended" ? "active" : "suspended";
    const { error: err } = await supabase
      .from("tenants")
      .update({ status: next })
      .eq("id", tenantId);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(next === "suspended" ? "Imobiliária bloqueada." : "Imobiliária reativada.");
    refetch();
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Faturamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão consolidada de planos contratados, assinaturas e cobranças de todos os tenants — a
          gestão de comissões e contas de cada imobiliária continua em{" "}
          <code className="rounded bg-muted px-1">/app/financeiro</code>.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && (
        <p className="text-sm text-rose-600">Erro ao carregar dados: {(error as Error).message}</p>
      )}

      {data && (
        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
            <TabsTrigger value="faturas">Faturas</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={TrendingUp}
                label="MRR estimado"
                value={formatBRL(data.kpis.mrr)}
                hint="Run-rate atual dos tenants ativos e em dia"
                tone="success"
              />
              <KpiCard
                icon={Wallet}
                label="Receita do mês"
                value={formatBRL(data.kpis.receita_mes)}
                hint="Pagamentos aprovados neste mês"
              />
              <KpiCard
                icon={Users}
                label="Ativos pagantes"
                value={String(data.kpis.tenants_ativos_pagantes)}
                tone="success"
              />
              <KpiCard
                icon={AlertTriangle}
                label="Inadimplentes"
                value={String(data.kpis.tenants_inadimplentes)}
                tone={data.kpis.tenants_inadimplentes > 0 ? "danger" : "default"}
              />
              <KpiCard
                icon={Ban}
                label="Bloqueados"
                value={String(data.kpis.tenants_bloqueados)}
                tone={data.kpis.tenants_bloqueados > 0 ? "danger" : "default"}
              />
              <KpiCard
                icon={Clock}
                label="Em período de graça"
                value={String(data.kpis.tenants_em_graca)}
                tone={data.kpis.tenants_em_graca > 0 ? "warning" : "default"}
              />
              <KpiCard
                icon={XCircle}
                label="Assinaturas canceladas"
                value={String(data.kpis.tenants_cancelados)}
              />
              <KpiCard icon={Gift} label="Plano Free" value={String(data.kpis.tenants_free)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Distribuição por plano</h2>
                <p className="text-xs text-muted-foreground">Quantidade de tenants em cada plano</p>
                <div className="mt-4 h-64">
                  <ClientOnly fallback={<div className="h-full" />}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.distribuicao_planos}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="plano_nome" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar
                          dataKey="count"
                          name="Tenants"
                          fill="var(--primary)"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ClientOnly>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Receita — últimos 6 meses</h2>
                <p className="text-xs text-muted-foreground">Pagamentos aprovados por mês</p>
                <div className="mt-4 h-64">
                  <ClientOnly fallback={<div className="h-full" />}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.receita_por_mes}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => formatBRL(Number(v))} />
                        <Line
                          type="monotone"
                          dataKey="receita"
                          name="Receita"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ClientOnly>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assinaturas">
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Imobiliária</th>
                      <th className="px-4 py-2">Plano</th>
                      <th className="px-4 py-2">Ciclo</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Pagamento</th>
                      <th className="px-4 py-2">Trial/Graça até</th>
                      <th className="px-4 py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assinaturas.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                          Nenhum tenant cadastrado ainda.
                        </td>
                      </tr>
                    )}
                    {data.assinaturas.map((a) => (
                      <tr key={a.tenant_id} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">{a.tenant_nome}</td>
                        <td className="px-4 py-2">
                          {a.plano_nome}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({formatBRL(a.valor_mensal_equivalente)}/mês)
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {a.plan_cycle === "annual"
                            ? "Anual"
                            : a.plan_cycle === "monthly"
                              ? "Mensal"
                              : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Pill
                            label={a.status}
                            className={statusColor[a.status] ?? "text-muted-foreground bg-muted"}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Pill
                            label={paymentStatusLabel[a.payment_status] ?? a.payment_status}
                            className={
                              paymentStatusColor[a.payment_status] ??
                              "text-muted-foreground bg-muted"
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {a.trial_grace_ends_at
                            ? new Date(a.trial_grace_ends_at).toLocaleDateString("pt-BR")
                            : a.trial_ends_at
                              ? new Date(a.trial_ends_at).toLocaleDateString("pt-BR")
                              : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => toggleTenantStatus(a.tenant_id, a.status)}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                          >
                            {a.status === "suspended" ? (
                              <>
                                <UserCheck className="h-3 w-3" /> Reativar
                              </>
                            ) : (
                              <>
                                <Ban className="h-3 w-3" /> Bloquear
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="faturas">
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Data</th>
                      <th className="px-4 py-2">Imobiliária</th>
                      <th className="px-4 py-2">Tipo de evento</th>
                      <th className="px-4 py-2">Valor</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.faturas.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                          Nenhuma notificação de pagamento registrada ainda.
                        </td>
                      </tr>
                    )}
                    {data.faturas.map((f) => (
                      <tr key={f.id} className="border-t border-border">
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {new Date(f.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2 font-medium">{f.tenant_nome}</td>
                        <td className="px-4 py-2 text-xs">{f.event_type}</td>
                        <td className="px-4 py-2">
                          {f.amount != null ? formatBRL(f.amount) : "—"}
                        </td>
                        <td className="px-4 py-2">
                          {f.processed_at ? (
                            <Pill
                              label="Processado"
                              className="text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30"
                            />
                          ) : (
                            <Pill
                              label="Pendente"
                              className="text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
