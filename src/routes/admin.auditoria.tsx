import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
};

function AuditoriaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const entities = useMemo(() => Array.from(new Set(rows.map((r) => r.entity).filter(Boolean))) as string[], [rows]);

  const filtered = rows.filter((r) => {
    if (entity && r.entity !== entity) return false;
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    return (
      (r.entity ?? "").toLowerCase().includes(term) ||
      (r.entity_id ?? "").toLowerCase().includes(term) ||
      (r.action ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Últimos 300 eventos da plataforma.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="w-72 pl-9" placeholder="Buscar por entidade, id ou ação…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          <option value="">Todas as entidades</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
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
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhum evento.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2">
                  <Badge className={ACTION_TONE[r.action] ?? "bg-muted text-foreground"} variant="outline">{r.action}</Badge>
                </td>
                <td className="px-4 py-2">{r.entity ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.entity_id?.slice(0, 8) ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.tenant_id?.slice(0, 8) ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.user_id?.slice(0, 8) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}