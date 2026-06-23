import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Search, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/auditoria")({
  component: AuditoriaPage,
});

type Row = {
  id: string;
  created_at: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  user_id: string | null;
  tenant_id: string | null;
  metadata: any;
};

const ACTION_TONE: Record<string, string> = {
  insert: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  update: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delete: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  access: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};

const ACTIONS = ["insert", "update", "delete", "access"];

function AuditoriaPage() {
  const [rows, setRows]     = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]           = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const entities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entity).filter(Boolean))) as string[],
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (entity && r.entity !== entity) return false;
    if (action && r.action !== action) return false;
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    return (
      (r.entity ?? "").toLowerCase().includes(term) ||
      (r.entity_id ?? "").toLowerCase().includes(term) ||
      (r.user_id ?? "").toLowerCase().includes(term) ||
      (r.tenant_id ?? "").toLowerCase().includes(term) ||
      (r.action ?? "").toLowerCase().includes(term)
    );
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Auditoria</h1>
            <p className="text-sm text-muted-foreground">
              Últimas {rows.length} entradas — todas as mutações em recursos sensíveis.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-9"
            placeholder="Buscar por entidade, id, user…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          <option value="">Todas as entidades</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        <div className="flex gap-1.5">
          <button
            onClick={() => setAction("")}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${!action ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Todos
          </button>
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setAction(a === action ? "" : a)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                action === a
                  ? `${ACTION_TONE[a]} border-current`
                  : "border-border hover:bg-muted"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {(q || entity || action) && (
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => { setQ(""); setEntity(""); setAction(""); }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {filtered.length} evento{filtered.length !== 1 ? "s" : ""} exibido{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Tabela */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-6 px-2 py-2" />
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Ação</th>
              <th className="px-4 py-2">Entidade</th>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Usuário</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum evento.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const isExpanded = expanded.has(r.id);
              const hasMetadata = r.metadata && Object.keys(r.metadata).length > 0;
              return [
                <tr key={r.id} className="border-t border-border hover:bg-muted/20 transition">
                  <td className="px-2 py-2 text-center">
                    {hasMetadata ? (
                      <button onClick={() => toggleExpand(r.id)} className="text-muted-foreground hover:text-foreground">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground text-xs">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={ACTION_TONE[r.action] ?? "bg-muted text-foreground"} variant="outline">
                      {r.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-medium">{r.entity ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {r.entity_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {r.tenant_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {r.user_id?.slice(0, 8) ?? "—"}
                  </td>
                </tr>,
                isExpanded && hasMetadata ? (
                  <tr key={`${r.id}-meta`} className="border-t border-border bg-muted/10">
                    <td colSpan={7} className="px-6 py-3">
                      <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
