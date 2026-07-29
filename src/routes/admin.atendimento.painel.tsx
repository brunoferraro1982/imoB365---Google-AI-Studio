import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Building2, Clock, Star, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { calcularMetricasChamados, type ChamadoMetrico } from "@/lib/chamadosMetrics";
import { STATUS_LABEL, CATEGORIA_LABEL, CANAL_LABEL } from "@/lib/chamadosLabels";

export const Route = createFileRoute("/admin/atendimento/painel")({
  component: PainelAdminAtendimentoPage,
});

type ChamadoAdmin = ChamadoMetrico & { tenant_id: string | null };

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Clock;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function ContagemLista({
  titulo,
  itens,
  labels,
}: {
  titulo: string;
  itens: { chave: string; total: number }[];
  labels: Record<string, string>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {itens.map((i) => (
            <Badge key={i.chave} variant="outline" className="px-3 py-1 text-sm">
              {labels[i.chave] ?? i.chave}: <span className="ml-1 font-semibold">{i.total}</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function PainelAdminAtendimentoPage() {
  const [chamadosImob365, setChamadosImob365] = useState<ChamadoMetrico[]>([]);
  const [chamadosTenant, setChamadosTenant] = useState<ChamadoAdmin[]>([]);
  const [tenantNomes, setTenantNomes] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: imob365 }, { data: tenant }, { data: tenants }] = await Promise.all([
        supabase
          .from("chamados")
          .select(
            "status,categoria,canal_origem,created_at,primeira_resposta_em,resolvido_em,csat_nota",
          )
          .eq("responsavel_tipo", "imob365"),
        supabase
          .from("chamados")
          .select(
            "tenant_id,status,categoria,canal_origem,created_at,primeira_resposta_em,resolvido_em,csat_nota",
          )
          .eq("responsavel_tipo", "tenant"),
        supabase.from("tenants").select("id,nome"),
      ]);
      setChamadosImob365((imob365 ?? []) as ChamadoMetrico[]);
      setChamadosTenant((tenant ?? []) as ChamadoAdmin[]);
      setTenantNomes(
        new Map((tenants ?? []).map((t: { id: string; nome: string }) => [t.id, t.nome])),
      );
      setLoading(false);
    }
    load();
  }, []);

  const mImob365 = calcularMetricasChamados(chamadosImob365);
  const mTenant = calcularMetricasChamados(chamadosTenant);

  const porTenant = Array.from(
    chamadosTenant.reduce((mapa, c) => {
      const chave = c.tenant_id ?? "sem-tenant";
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
      return mapa;
    }, new Map<string, number>()),
  )
    .map(([tenantId, total]) => ({
      tenantId,
      nome: tenantId === "sem-tenant" ? "Sem tenant" : (tenantNomes.get(tenantId) ?? tenantId),
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6" />
          Painel da Central de Atendimento — imoB365
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão consolidada do balcão imoB365 e volume cross-tenant dos balcões das
          imobiliárias/corretores.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Balcão imoB365 (suporte da plataforma)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile label="Total de chamados" value={String(mImob365.total)} />
              <StatTile label="Em aberto" value={String(mImob365.abertos)} />
              <StatTile label="Resolvidos" value={String(mImob365.resolvidos)} />
              <StatTile
                label="Tempo médio 1ª resposta"
                value={
                  mImob365.tempoMedioRespostaMin != null
                    ? `${mImob365.tempoMedioRespostaMin} min`
                    : "—"
                }
                icon={Clock}
              />
              <StatTile
                label="Tempo médio resolução"
                value={
                  mImob365.tempoMedioResolucaoHoras != null
                    ? `${mImob365.tempoMedioResolucaoHoras} h`
                    : "—"
                }
                icon={TrendingUp}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cross-tenant (todos os balcões de imobiliárias/corretores)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Total de chamados" value={String(mTenant.total)} />
              <StatTile label="Em aberto" value={String(mTenant.abertos)} />
              <StatTile
                label="CSAT médio"
                value={mTenant.csatMedio != null ? `${mTenant.csatMedio} / 5` : "—"}
                icon={Star}
              />
              <StatTile
                label="Tempo médio resolução"
                value={
                  mTenant.tempoMedioResolucaoHoras != null
                    ? `${mTenant.tempoMedioResolucaoHoras} h`
                    : "—"
                }
                icon={TrendingUp}
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Top 10 tenants por volume de chamados
            </h3>
            {porTenant.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {porTenant.map((t) => (
                  <div
                    key={t.tenantId}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <span>{t.nome}</span>
                    <Badge variant="secondary">{t.total}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <ContagemLista
              titulo="Por status (todos)"
              itens={mTenant.porStatus}
              labels={STATUS_LABEL}
            />
            <ContagemLista
              titulo="Por categoria (todos)"
              itens={mTenant.porCategoria}
              labels={CATEGORIA_LABEL}
            />
            <ContagemLista
              titulo="Por canal (todos)"
              itens={mTenant.porCanal}
              labels={CANAL_LABEL}
            />
          </div>
        </>
      )}
    </div>
  );
}
