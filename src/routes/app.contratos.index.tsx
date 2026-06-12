import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, FileText, Pencil, Trash2, LayoutTemplate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/contratos/")({
  component: ContratosList,
});

export const TIPO_LABEL: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  permuta: "Permuta",
  parceria: "Parceria",
  administracao: "Administração",
  prestacao_servico: "Prest. de Serviço",
  outro: "Outro",
};

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ativo: "default",
  rascunho: "secondary",
  encerrado: "outline",
  cancelado: "destructive",
};

export const ASSINATURA_INFO: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Não enviado", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  enviado: { label: "Aguardando", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  assinado_parcial: { label: "Parcial (1/2)", className: "bg-indigo-100 text-indigo-800 animate-pulse dark:bg-indigo-900/40 dark:text-indigo-300" },
  assinado_total: { label: "Assinado ✓", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

type Contrato = {
  id: string;
  numero: string | null;
  tipo: string;
  status: string;
  valor: number;
  data_inicio: string | null;
  assinatura_status: string | null;
  updated_at: string;
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ContratosList() {
  const [items, setItems] = useState<Contrato[]>([]);
  const { tenantId } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  async function load() {
    setLoading(true);
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const { data, error } = await (supabase as any)
      .from("contratos")
      .select("id,numero,tipo,status,valor,data_inicio,assinatura_status,updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Contrato[]);
    setLoading(false);
  }

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  async function remove(id: string) {
    if (!(await confirmDialog("Excluir este contrato? Esta ação não pode ser desfeita."))) return;
    const { error } = await supabase
      .from("contratos")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId ?? "");
    if (error) return toast.error(error.message);
    toast.success("Contrato excluído");
    load();
  }

  // KPIs
  const ativos = items.filter((c) => c.status === "ativo").length;
  const rascunhos = items.filter((c) => c.status === "rascunho").length;
  const valorAtivo = items
    .filter((c) => c.status === "ativo")
    .reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const assinados = items.filter((c) => c.assinatura_status === "assinado_total").length;

  // Filtering
  const filtered = items.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      (c.numero ?? "").toLowerCase().includes(q) ||
      (TIPO_LABEL[c.tipo] ?? c.tipo).toLowerCase().includes(q);
    const matchStatus = !filterStatus || c.status === filterStatus;
    const matchTipo = !filterTipo || c.tipo === filterTipo;
    return matchSearch && matchStatus && matchTipo;
  });

  const hasFilters = search || filterStatus || filterTipo;

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jurídico</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contratos, modelos jurídicos e assinaturas digitais.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/contratos/modelos">
            <Button variant="outline">
              <LayoutTemplate className="mr-2 h-4 w-4" /> Modelos
            </Button>
          </Link>
          <Link to="/app/contratos/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo contrato
            </Button>
          </Link>
        </div>
      </header>

      {/* KPI Cards */}
      {!loading && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total" value={items.length} sub="contratos cadastrados" />
          <StatCard label="Ativos" value={ativos} sub="em vigência" />
          <StatCard label="Rascunhos" value={rascunhos} sub="pendentes de ativação" />
          <StatCard
            label="Valor total ativo"
            value={formatBRL(valorAtivo)}
            sub={`${assinados} assinado${assinados !== 1 ? "s" : ""}`}
          />
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por número ou tipo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilterStatus("");
              setFilterTipo("");
            }}
            className="text-muted-foreground"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">
            {items.length === 0
              ? "Nenhum contrato cadastrado ainda."
              : "Nenhum contrato para os filtros selecionados."}
          </p>
          {items.length === 0 && (
            <Link to="/app/contratos/novo" className="mt-4 inline-block">
              <Button size="sm">Criar primeiro contrato</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-left">Início</th>
                <th className="px-4 py-3 text-left">Assinatura</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const assInfo = ASSINATURA_INFO[c.assinatura_status ?? "rascunho"] ?? ASSINATURA_INFO.rascunho;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {c.numero ?? `#${c.id.slice(0, 8)}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {TIPO_LABEL[c.tipo] ?? c.tipo}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatBRL(c.valor)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.data_inicio
                        ? new Date(c.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${assInfo.className}`}
                      >
                        {assInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/app/contratos/$id" params={{ id: c.id }}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
