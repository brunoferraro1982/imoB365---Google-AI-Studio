import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { moduleGuard } from "@/lib/routeGuard";
import { formatBRL } from "@/lib/format";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/contratosLabels";
import { Home, Landmark, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/locacao/")({
  // Mesma permissão das sub-rotas de locação (repasses e prestação de contas).
  beforeLoad: moduleGuard("financeiro"),
  component: LocacaoIndex,
});

type ContratoRow = {
  id: string;
  numero: string | null;
  valor: number | null;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  dia_vencimento: number | null;
  imovel: { titulo: string | null } | null;
};

type LinhaLocacao = ContratoRow & {
  locadores: string;
  locatarios: string;
  proximoReajuste: string | null;
};

/** Data local no formato YYYY-MM-DD (comparável como string). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function LocacaoIndex() {
  const { tenantId } = useAuth();
  const [linhas, setLinhas] = useState<LinhaLocacao[]>([]);
  const [osAbertas, setOsAbertas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [venc60, setVenc60] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [contratosRes, partesRes, reajustesRes, osRes] = await Promise.all([
      (supabase as any)
        .from("contratos")
        .select("id,numero,valor,status,data_inicio,data_fim,dia_vencimento,imovel:imoveis(titulo)")
        .eq("tenant_id", tenantId)
        .eq("tipo", "locacao")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("contrato_partes")
        .select("contrato_id,nome,papel")
        .eq("tenant_id", tenantId)
        .in("papel", ["locador", "locatario"]),
      (supabase as any)
        .from("locacao_reajustes")
        .select("contrato_id,proximo_reajuste")
        .eq("tenant_id", tenantId),
      (supabase as any)
        .from("locacao_ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .neq("status", "concluida"),
    ]);

    if (contratosRes.error) toast.error(contratosRes.error.message);

    const locadores = new Map<string, string[]>();
    const locatarios = new Map<string, string[]>();
    for (const p of (partesRes.data ?? []) as {
      contrato_id: string;
      nome: string;
      papel: string;
    }[]) {
      const alvo = p.papel === "locador" ? locadores : locatarios;
      alvo.set(p.contrato_id, [...(alvo.get(p.contrato_id) ?? []), p.nome]);
    }
    const reajustes = new Map<string, string | null>();
    for (const r of (reajustesRes.data ?? []) as {
      contrato_id: string;
      proximo_reajuste: string | null;
    }[]) {
      reajustes.set(r.contrato_id, r.proximo_reajuste);
    }

    const rows = (contratosRes.data ?? []) as ContratoRow[];
    setLinhas(
      rows.map((c) => ({
        ...c,
        locadores: (locadores.get(c.id) ?? []).join(", "),
        locatarios: (locatarios.get(c.id) ?? []).join(", "),
        proximoReajuste: reajustes.get(c.id) ?? null,
      })),
    );
    setOsAbertas(osRes.count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  const hoje = isoLocal(new Date());
  const limite60 = isoLocal(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtroStatus && l.status !== filtroStatus) return false;
      if (venc60 && !(l.data_fim && l.data_fim >= hoje && l.data_fim <= limite60)) return false;
      if (termo) {
        const texto = `${l.numero ?? ""} ${l.imovel?.titulo ?? ""} ${l.locatarios}`.toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });
  }, [linhas, busca, filtroStatus, venc60, hoje, limite60]);

  const hasFiltros = busca !== "" || filtroStatus !== "" || venc60;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Home className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Locação / Administração</h1>
        </div>
        {/* Espaço reservado para o botão "Nova locação" (adicionado em outra tarefa). */}
        <div />
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Contratos de locação
          </p>
          <p className="mt-2 text-2xl font-bold">{linhas.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ordens de serviço abertas
          </p>
          <p className="mt-2 text-2xl font-bold">{osAbertas}</p>
          <Link
            to="/app/locacao/prestacao-contas"
            className="mt-1 inline-block text-xs text-primary hover:underline"
          >
            Ver prestação de contas
          </Link>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Repasses ao proprietário
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Geração mensal, taxa de administração e status ficam em Repasses.
          </p>
          <Link to="/app/locacao/repasses">
            <Button size="sm" variant="outline" className="mt-3">
              <Landmark className="mr-1 h-4 w-4" /> Ver repasses
            </Button>
          </Link>
        </div>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por imóvel, locatário ou número…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={venc60}
              onChange={(e) => setVenc60(e.target.checked)}
              className="h-4 w-4"
            />
            Vencendo em 60 dias
          </label>
          {hasFiltros && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setBusca("");
                setFiltroStatus("");
                setVenc60(false);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando locações…</p>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Wallet className="h-8 w-8" />
            {linhas.length === 0
              ? "Nenhum contrato de locação cadastrado."
              : "Nenhuma locação encontrada com os filtros atuais."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Contrato</th>
                  <th className="px-3 py-2">Imóvel</th>
                  <th className="px-3 py-2">Locador</th>
                  <th className="px-3 py-2">Locatário</th>
                  <th className="px-3 py-2 text-right">Aluguel</th>
                  <th className="px-3 py-2">Venc.</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Vigência</th>
                  <th className="px-3 py-2">Próx. reajuste</th>
                  <th className="px-3 py-2">Taxa adm.</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => (
                  <tr key={l.id} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{l.numero ?? l.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{l.imovel?.titulo ?? "—"}</td>
                    <td className="px-3 py-2">{l.locadores || "—"}</td>
                    <td className="px-3 py-2">{l.locatarios || "—"}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(l.valor)}</td>
                    <td className="px-3 py-2">
                      {l.dia_vencimento ? `Dia ${l.dia_vencimento}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtData(l.data_inicio)} – {fmtData(l.data_fim)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtData(l.proximoReajuste)}</td>
                    {/* Campo de taxa de administração ainda não existe em contratos. */}
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link to="/app/contratos/$id" params={{ id: l.id }}>
                          <Button size="sm" variant="outline">
                            Abrir contrato
                          </Button>
                        </Link>
                        <Link to="/app/locacao/repasses">
                          <Button size="sm" variant="ghost">
                            Repasses
                          </Button>
                        </Link>
                        <Link to="/app/locacao/prestacao-contas">
                          <Button size="sm" variant="ghost">
                            Prestação de contas
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
