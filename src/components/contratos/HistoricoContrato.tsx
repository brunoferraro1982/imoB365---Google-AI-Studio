import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

// CLM Sprint 12 — audit_log/tg_audit() já existiam e já cobriam `contratos`
// desde sempre; este painel só dá visibilidade a esse histórico dentro do
// próprio contrato (reaproveita o layout de admin.auditoria.tsx). Mostra só
// eventos do próprio registro do contrato (entity_id = contrato.id) — os
// sub-registros (partes, parcelas, checklist, garantias, reajustes, etc.,
// também auditados neste mesmo sprint) não aparecem aqui: pra um INSERT,
// tg_audit() grava metadata vazio ({}), sem nenhuma referência ao
// contrato_id da linha criada, então não há como correlacionar de forma
// confiável sem mais uma mudança de schema — fora do escopo deste sprint.
const ACTION_LABEL: Record<string, string> = {
  insert: "Criado",
  update: "Atualizado",
  delete: "Removido",
};
const ACTION_TONE: Record<string, string> = {
  insert: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  update: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delete: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

type Evento = {
  id: string;
  created_at: string;
  action: string;
  metadata: { changes?: Record<string, { old: unknown; new: unknown }> } | null;
};

function formatarValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
}

export function HistoricoContrato({ contratoId }: { contratoId: string }) {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin && !isSuperAdmin) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("audit_log")
        .select("id,created_at,action,metadata")
        .eq("entity", "contratos")
        .eq("entity_id", contratoId)
        .order("created_at", { ascending: false })
        .limit(50);
      setEventos((data ?? []) as Evento[]);
      setLoading(false);
    })();
  }, [contratoId, isAdmin, isSuperAdmin]);

  if (!isAdmin && !isSuperAdmin) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold">
          <History className="h-4 w-4" /> Histórico
        </h2>
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem ver o histórico de alterações do contrato.
        </p>
      </section>
    );
  }

  if (loading) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold">
        <History className="h-4 w-4" /> Histórico
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Alterações registradas nos dados gerais deste contrato.
      </p>

      {eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {eventos.map((e) => {
            const changes = e.metadata?.changes ?? {};
            const campos = Object.keys(changes).filter((k) => k !== "updated_at");
            return (
              <li key={e.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <Badge className={ACTION_TONE[e.action] ?? "bg-muted"} variant="outline">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {campos.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {campos.map((campo) => (
                      <li key={campo}>
                        <span className="font-medium text-foreground">{campo}</span>:{" "}
                        {formatarValor(changes[campo].old)} → {formatarValor(changes[campo].new)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
