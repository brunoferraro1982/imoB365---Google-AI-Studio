import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, AlertCircle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tarefas")({
  component: TarefasPage,
});

type Tarefa = {
  id: string;
  lead_id: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  status: string;
  prazo: string | null;
  created_at: string;
  lead?: { nome: string; id: string } | null;
};

function TarefasPage() {
  const { tenantId, user } = useAuth();
  const [filtro, setFiltro] = useState<"minhas" | "todas" | "concluidas">("minhas");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    let q = (supabase as any)
      .from("lead_tarefas")
      .select("*, lead:leads(id,nome)")
      .eq("tenant_id", tenantId)
      .order("prazo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (filtro === "minhas") q = q.eq("status", "pendente").eq("responsavel_user_id", user?.id ?? "");
    else if (filtro === "todas") q = q.eq("status", "pendente");
    else q = q.eq("status", "concluida");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setTarefas((data ?? []) as Tarefa[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [tenantId, filtro, user?.id]);

  async function toggle(t: Tarefa) {
    const novo = t.status === "concluida" ? "pendente" : "concluida";
    await (supabase as any).from("lead_tarefas").update({
      status: novo,
      concluida_em: novo === "concluida" ? new Date().toISOString() : null,
    }).eq("id", t.id);
    load();
  }

  const now = new Date();
  const pendentes = tarefas.filter((t) => t.status === "pendente");
  const atrasadas = pendentes.filter((t) => t.prazo && new Date(t.prazo) < now);
  const hoje = pendentes.filter((t) => {
    if (!t.prazo) return false;
    const d = new Date(t.prazo);
    return d.toDateString() === now.toDateString();
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Tarefas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lembretes e follow-ups dos leads.</p>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Atrasadas</div>
          <div className="mt-1 text-2xl font-bold text-rose-600">{atrasadas.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Hoje</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{hoje.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Pendentes</div>
          <div className="mt-1 text-2xl font-bold">{pendentes.length}</div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(["minhas", "todas", "concluidas"] as const).map((f) => (
          <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>
            {f === "minhas" ? "Minhas pendentes" : f === "todas" ? "Todas pendentes" : "Concluídas"}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : tarefas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma tarefa.</p>
      ) : (
        <ul className="space-y-2">
          {tarefas.map((t) => {
            const atrasada = t.status === "pendente" && t.prazo && new Date(t.prazo) < now;
            return (
              <li key={t.id} className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm">
                <button onClick={() => toggle(t)} className="mt-0.5">
                  {t.status === "concluida"
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />}
                </button>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={t.status === "concluida" ? "line-through" : "font-medium"}>{t.titulo}</span>
                    <Badge variant="outline" className="text-[10px]">{t.tipo}</Badge>
                    {t.prioridade === "alta" && <Badge className="bg-rose-600 text-[10px]">alta</Badge>}
                    {atrasada && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px]">
                        <AlertCircle className="mr-1 h-3 w-3" /> atrasada
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {t.prazo && <span>{new Date(t.prazo).toLocaleString("pt-BR")}</span>}
                    {t.lead && (
                      <Link to="/app/leads/$id" params={{ id: t.lead_id }} className="flex items-center gap-1 hover:text-primary">
                        Lead: {t.lead.nome} <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}