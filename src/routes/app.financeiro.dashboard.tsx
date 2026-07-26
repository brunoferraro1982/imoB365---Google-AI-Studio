import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Wallet, TrendingUp, Building2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { getFinanceiroDashboard } from "@/lib/financeiroDashboard.functions";
import { formatBRL } from "@/lib/format";
import { moduleGuard } from "@/lib/routeGuard";

export const Route = createFileRoute("/app/financeiro/dashboard")({
  beforeLoad: moduleGuard("financeiro"),
  head: () => ({ meta: [{ title: "Dashboard executivo — imob365" }] }),
  component: FinanceiroDashboardPage,
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
  icon: typeof Building2;
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

function FinanceiroDashboardPage() {
  const fetchDashboard = useServerFn(getFinanceiroDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["financeiro-dashboard"],
    queryFn: () => fetchDashboard(),
  });

  return (
    <div className="p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard executivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inadimplência, comissões, rentabilidade por imóvel e fluxo de caixa projetado.
        </p>
      </header>

      {error && (
        <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {isLoading || !data ? (
        <div className="mt-10 text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Inadimplência"
              value={formatBRL(data.inadimplencia.total_atrasado)}
              hint={`${data.inadimplencia.count_atrasado} lançamento(s) atrasado(s)`}
              icon={AlertTriangle}
              tone="danger"
            />
            <KpiCard
              label="Pendente (a vencer)"
              value={formatBRL(data.inadimplencia.total_pendente)}
              icon={Wallet}
              tone="warning"
            />
            <KpiCard
              label="Comissões pagas"
              value={formatBRL(data.comissoes.total_paga)}
              icon={TrendingUp}
              tone="success"
            />
            <KpiCard
              label="Comissões a pagar"
              value={formatBRL(data.comissoes.total_a_pagar)}
              hint={`${data.comissoes.count_a_pagar} comissão(ões)`}
              icon={Wallet}
              tone="warning"
            />
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Receita por corretor</h2>
              <p className="text-xs text-muted-foreground">
                Soma de comissões (excluindo canceladas)
              </p>
              <div className="mt-4 space-y-3">
                {data.receita_por_corretor.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma comissão registrada.</p>
                )}
                {data.receita_por_corretor.map((r, idx) => {
                  const max = Math.max(...data.receita_por_corretor.map((x) => x.total), 1);
                  const pct = Math.round((r.total / max) * 100);
                  return (
                    <div key={`${r.corretor}-${idx}`}>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                            {idx + 1}
                          </span>
                          <span>{r.corretor}</span>
                        </div>
                        <span className="text-muted-foreground">{formatBRL(r.total)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Rentabilidade por imóvel</h2>
              <p className="text-xs text-muted-foreground">
                Repasse do mês corrente menos despesas do imóvel no período
              </p>
              {data.rentabilidade_por_imovel.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nenhum imóvel com contrato de locação ativo.
                </p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-2 text-left">Imóvel</th>
                      <th className="pb-2 text-right">Aluguel</th>
                      <th className="pb-2 text-right">Despesas</th>
                      <th className="pb-2 text-right">Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rentabilidade_por_imovel.map((r, idx) => (
                      <tr
                        key={`${r.imovel}-${idx}`}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-2 truncate">{r.imovel}</td>
                        <td className="py-2 text-right text-emerald-600">{formatBRL(r.aluguel)}</td>
                        <td className="py-2 text-right text-red-600">− {formatBRL(r.despesas)}</td>
                        <td className="py-2 text-right font-semibold">{formatBRL(r.liquido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Fluxo de caixa projetado</h2>
            <p className="text-xs text-muted-foreground">
              Lançamentos pendentes/atrasados por mês de vencimento, próximos 6 meses — sem
              previsão, é o que já está lançado.
            </p>
            <div className="mt-4 h-64">
              <ClientOnly fallback={<div className="h-full" />}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.fluxo_caixa_projetado}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) =>
                        Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="entradas"
                      name="Entradas"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="saidas"
                      name="Saídas"
                      fill="var(--destructive)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
