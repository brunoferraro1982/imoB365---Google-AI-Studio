import { useEffect, useState } from "react";
import { Calendar, MessageSquare, Phone, Mail, FileText, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Evento = {
  id: string;
  tipo: "interacao" | "mensagem" | "visita" | "tarefa";
  titulo: string;
  descricao?: string | null;
  data: string;
};

const ICON: Record<string, any> = {
  interacao: Activity,
  mensagem: MessageSquare,
  visita: Calendar,
  tarefa: FileText,
};

export function LeadTimeline({ leadId }: { leadId: string }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [interacoes, mensagens, visitas, tarefas] = await Promise.all([
        supabase
          .from("lead_interacoes")
          .select("id, tipo, descricao, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("lead_mensagens")
          .select("id, canal, conteudo, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("visitas")
          .select("id, data_visita, observacoes, status")
          .eq("lead_id", leadId)
          .order("data_visita", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("lead_tarefas")
          .select("id, titulo, status, deadline")
          .eq("lead_id", leadId)
          .order("deadline", { ascending: false })
          .limit(20),
      ]);
      const evs: Evento[] = [];
      (interacoes.data ?? []).forEach((r: any) =>
        evs.push({
          id: `i-${r.id}`,
          tipo: "interacao",
          titulo: r.tipo ?? "Interação",
          descricao: r.descricao,
          data: r.created_at,
        }),
      );
      (mensagens.data ?? []).forEach((r: any) =>
        evs.push({
          id: `m-${r.id}`,
          tipo: "mensagem",
          titulo: `Mensagem (${r.canal ?? "chat"})`,
          descricao: r.conteudo,
          data: r.created_at,
        }),
      );
      (visitas.data ?? []).forEach((r: any) =>
        evs.push({
          id: `v-${r.id}`,
          tipo: "visita",
          titulo: `Visita — ${r.status ?? "agendada"}`,
          descricao: r.observacoes,
          data: r.data_visita,
        }),
      );
      (tarefas.data ?? []).forEach((r: any) =>
        evs.push({
          id: `t-${r.id}`,
          tipo: "tarefa",
          titulo: r.titulo,
          descricao: r.status,
          data: r.deadline ?? new Date().toISOString(),
        }),
      );
      evs.sort((a, b) => (a.data < b.data ? 1 : -1));
      setEventos(evs);
      setLoading(false);
    })();
  }, [leadId]);

  if (loading)
    return <div className="text-sm text-muted-foreground">Carregando linha do tempo…</div>;
  if (!eventos.length)
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhuma atividade ainda — registre uma interação para começar.
      </div>
    );

  return (
    <div className="space-y-3">
      {eventos.map((ev) => {
        const Icon = ICON[ev.tipo] ?? Activity;
        return (
          <div key={ev.id} className="flex gap-3 rounded-lg border border-border bg-card p-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{ev.titulo}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(ev.data).toLocaleString("pt-BR")}
                </span>
              </div>
              {ev.descricao && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{ev.descricao}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
