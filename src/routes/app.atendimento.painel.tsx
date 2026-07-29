import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Clock, MessageSquareText, Star, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { moduleGuard } from "@/lib/routeGuard";
import { calcularMetricasChamados, type ChamadoMetrico } from "@/lib/chamadosMetrics";
import { STATUS_LABEL, CATEGORIA_LABEL, CANAL_LABEL } from "@/lib/chamadosLabels";

export const Route = createFileRoute("/app/atendimento/painel")({
  beforeLoad: moduleGuard("atendimento"),
  component: PainelAtendimentoPage,
});

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

function PainelAtendimentoPage() {
  const { tenantId } = useAuth();
  const [chamados, setChamados] = useState<ChamadoMetrico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!tenantId) return;
      setLoading(true);
      const { data } = await supabase
        .from("chamados")
        .select(
          "status,categoria,canal_origem,created_at,primeira_resposta_em,resolvido_em,csat_nota",
        )
        .eq("responsavel_tipo", "tenant")
        .eq("tenant_id", tenantId);
      setChamados((data ?? []) as ChamadoMetrico[]);
      setLoading(false);
    }
    load();
  }, [tenantId]);

  const m = calcularMetricasChamados(chamados);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6" />
          Painel da Central de Atendimento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Volume, tempo de resposta/resolução e satisfação dos chamados do seu tenant.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile label="Total de chamados" value={String(m.total)} />
            <StatTile label="Em aberto" value={String(m.abertos)} />
            <StatTile label="Resolvidos" value={String(m.resolvidos)} />
            <StatTile
              label="Tempo médio 1ª resposta"
              value={m.tempoMedioRespostaMin != null ? `${m.tempoMedioRespostaMin} min` : "—"}
              icon={Clock}
            />
            <StatTile
              label="Tempo médio resolução"
              value={m.tempoMedioResolucaoHoras != null ? `${m.tempoMedioResolucaoHoras} h` : "—"}
              icon={TrendingUp}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5" /> Satisfação (CSAT)
            </div>
            <div className="mt-1 text-2xl font-bold">
              {m.csatMedio != null ? `${m.csatMedio} / 5` : "—"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({m.csatRespostas} avaliação{m.csatRespostas === 1 ? "" : "ões"})
              </span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ContagemLista titulo="Por status" itens={m.porStatus} labels={STATUS_LABEL} />
            <ContagemLista titulo="Por categoria" itens={m.porCategoria} labels={CATEGORIA_LABEL} />
            <ContagemLista
              titulo="Por canal"
              itens={m.porCanal}
              labels={{ ...CANAL_LABEL, [""]: "—" }}
            />
          </div>

          {m.total === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              <MessageSquareText className="h-4 w-4" />
              Nenhum chamado registrado ainda pro seu tenant.
            </div>
          )}
        </>
      )}
    </div>
  );
}
