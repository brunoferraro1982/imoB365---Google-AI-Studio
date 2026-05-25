import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  Users,
  FileText,
  Banknote,
  TrendingUp,
  TrendingDown,
  Clock,
  Trophy,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { getRelatorios } from "@/lib/relatorios.functions";
import { formatBRL, TIPO_LABEL } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/relatorios")({
  component: RelatoriosPage,
});

const LEAD_STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  contato: "Em contato",
  visita: "Visita",
  proposta: "Proposta",
  ganho: "Ganho",
  perdido: "Perdido",
};

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

function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<number>(30);
  const fetchRel = useServerFn(getRelatorios);
  const { data, isLoading, error } = useQuery({
    queryKey: ["relatorios", periodo],
    queryFn: () => fetchRel({ data: { periodoDias: periodo } }),
  });

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Indicadores de catálogo, leads, contratos e financeiro.
          </p>
        </div>
        <div className="w-44">
          <Select value={String(periodo)} onValueChange={(v) => setPeriodo(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
              label="Imóveis ativos"
              value={String(data.kpis.imoveis_ativos)}
              hint={`${data.kpis.imoveis_publicados} publicados`}
              icon={Building2}
            />
            <KpiCard
              label="Valor de estoque"
              value={formatBRL(data.kpis.valor_estoque)}
              hint="Somatório de ativos"
              icon={Banknote}
            />
            <KpiCard
              label="Leads no período"
              value={String(data.kpis.leads_total)}
              hint={`${data.kpis.leads_novos} novos`}
              icon={Users}
            />
            <KpiCard
              label="Contratos em aberto"
              value={String(data.kpis.contratos_abertos)}
              icon={FileText}
            />
            <KpiCard
              label="Receita do mês"
              value={formatBRL(data.kpis.receita_mes)}
              icon={TrendingUp}
              tone="success"
            />
            <KpiCard
              label="Despesa do mês"
              value={formatBRL(data.kpis.despesa_mes)}
              icon={TrendingDown}
              tone="danger"
            />
            <KpiCard
              label="Pendente"
              value={formatBRL(data.kpis.pendente_total)}
              hint="Lançamentos a receber/pagar"
              icon={Clock}
              tone="warning"
            />
            <KpiCard
              label="Conversão"
              value={
                data.kpis.leads_total > 0
                  ? `${Math.round((data.kpis.leads_ganhos / data.kpis.leads_total) * 100)}%`
                  : "—"
              }
              hint={`${data.kpis.leads_ganhos} ganhos · ${data.kpis.leads_perdidos} perdidos`}
              icon={Trophy}
              tone="success"
            />
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Funil de conversão</h2>
            <p className="text-xs text-muted-foreground">
              Conversão acumulada e taxa entre etapas (perdidos excluídos).
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-5">
              {data.funil_conversao.map((f, idx) => (
                <div key={f.etapa} className="rounded-lg border p-3">
                  <div className="text-xs uppercase text-muted-foreground">{f.label}</div>
                  <div className="mt-1 text-2xl font-bold">{f.count}</div>
                  <div className="text-xs text-muted-foreground">{f.pct_acumulado}% do topo</div>
                  {f.conversao_proxima !== null && (
                    <div className="mt-2 text-[11px] text-emerald-600">
                      → {f.conversao_proxima}% avançam
                    </div>
                  )}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${f.pct_acumulado}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Tempo médio até primeiro contato</div>
                <div className="mt-1 text-lg font-semibold">
                  {data.tempo_medio_dias.ate_contato !== null ? `${data.tempo_medio_dias.ate_contato} dias` : "—"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Tempo médio até ganho</div>
                <div className="mt-1 text-lg font-semibold">
                  {data.tempo_medio_dias.ate_ganho !== null ? `${data.tempo_medio_dias.ate_ganho} dias` : "—"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Conversão final</div>
                <div className="mt-1 text-lg font-semibold">
                  {data.kpis.leads_total > 0
                    ? `${Math.round((data.kpis.leads_ganhos / data.kpis.leads_total) * 100)}%`
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Leads por dia</h2>
              <p className="text-xs text-muted-foreground">Volume diário no período selecionado</p>
              <div className="mt-4 h-64">
                <ClientOnly fallback={<div className="h-full" />}> 
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.leads_por_dia}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="novos"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                </ClientOnly>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Financeiro — últimos 6 meses</h2>
              <p className="text-xs text-muted-foreground">Entradas vs saídas (R$)</p>
              <div className="mt-4 h-64">
                <ClientOnly fallback={<div className="h-full" />}> 
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.financeiro_por_mes}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) =>
                        Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entradas" name="Entradas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </ClientOnly>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Funil de leads</h2>
              <p className="text-xs text-muted-foreground">No período selecionado</p>
              <div className="mt-4 space-y-3">
                {data.funil.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum lead no período.</p>
                )}
                {data.funil.map((f) => {
                  const total = data.kpis.leads_total || 1;
                  const pct = Math.round((f.count / total) * 100);
                  return (
                    <div key={f.status}>
                      <div className="flex justify-between text-xs">
                        <span>{LEAD_STATUS_LABEL[f.status] ?? f.status}</span>
                        <span className="text-muted-foreground">
                          {f.count} · {pct}%
                        </span>
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
              <h2 className="text-sm font-semibold">Top corretores</h2>
              <p className="text-xs text-muted-foreground">Por leads recebidos</p>
              <div className="mt-4 space-y-3">
                {data.ranking_corretores.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem leads atribuídos.</p>
                )}
                {data.ranking_corretores.map((r, idx) => (
                  <div key={`${r.corretor}-${idx}`} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {idx + 1}
                      </span>
                      <span>{r.corretor}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.leads} leads · {r.ganhos} ganhos
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Imóveis ativos por tipo</h2>
              <p className="text-xs text-muted-foreground">Distribuição do catálogo</p>
              <div className="mt-4 space-y-3">
                {data.imoveis_por_tipo.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem imóveis ativos.</p>
                )}
                {data.imoveis_por_tipo.map((t) => {
                  const total = data.kpis.imoveis_ativos || 1;
                  const pct = Math.round((t.count / total) * 100);
                  return (
                    <div key={t.tipo}>
                      <div className="flex justify-between text-xs">
                        <span>{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                        <span className="text-muted-foreground">
                          {t.count} · {pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Performance e Conversão do Imóvel widget (Sprint 5) */}
          <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Performance & Desempenho dos Anúncios</h2>
              <p className="text-xs text-muted-foreground">Monitoramento orgânico de visualizações, contatos via WhatsApp e favoritação por anúncio ativo</p>
            </div>
            
            {(!data.ranking_imoveis || data.ranking_imoveis.length === 0) ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum anúncio disponível para análise de performance de tráfego.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse select-none">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                      <th className="pb-3 pt-1">Imóvel</th>
                      <th className="pb-3 pt-1 text-center">Preço</th>
                      <th className="pb-3 pt-1 text-center font-sans">👥 Visualizações</th>
                      <th className="pb-3 pt-1 text-center font-sans">💬 Cliques WhatsApp</th>
                      <th className="pb-3 pt-1 text-center font-sans font-medium">⭐ Favoritos</th>
                      <th className="pb-3 pt-1 text-right">Taxa de Conversão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ranking_imoveis.map((im) => (
                      <tr key={im.id} className="border-b border-border/60 hover:bg-muted/50 transition-colors">
                        <td className="py-4 font-medium max-w-xs truncate">
                          <span className="block truncate text-foreground text-xs font-bold leading-tight">{im.titulo}</span>
                          <span className="text-[10px] text-muted-foreground font-mono uppercase">{im.bairro} · {TIPO_LABEL[im.tipo] ?? im.tipo}</span>
                        </td>
                        <td className="py-4 text-center text-xs font-bold font-mono text-primary">
                          {formatBRL(im.preco)}
                        </td>
                        <td className="py-4 text-center font-mono text-xs font-semibold text-muted-foreground">
                          {im.pageviews}
                        </td>
                        <td className="py-4 text-center font-mono text-xs font-semibold text-emerald-600">
                          {im.whatsapp_clicks}
                        </td>
                        <td className="py-4 text-center font-mono text-xs font-semibold text-amber-500">
                          {im.favorited}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono text-xs font-bold text-foreground">{im.conversion_rate}%</span>
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden relative">
                              <div 
                                className="h-full bg-emerald-500 rounded-full" 
                                style={{ width: `${Math.min(im.conversion_rate * 3.5, 100)}%` }} 
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}