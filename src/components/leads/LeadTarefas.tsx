import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  status: string;
  prazo: string | null;
  concluida_em: string | null;
  responsavel_user_id: string | null;
  created_at: string;
};

const TIPOS = [
  { v: "tarefa", label: "Tarefa" },
  { v: "ligacao", label: "Ligação" },
  { v: "whatsapp", label: "WhatsApp" },
  { v: "email", label: "E-mail" },
  { v: "visita", label: "Visita" },
  { v: "reuniao", label: "Reunião" },
];

const PRIORIDADES = [
  { v: "baixa", label: "Baixa" },
  { v: "media", label: "Média" },
  { v: "alta", label: "Alta" },
];

export function LeadTarefas({ leadId, tenantId }: { leadId: string; tenantId: string }) {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("tarefa");
  const [prioridade, setPrioridade] = useState("media");
  const [prazo, setPrazo] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await (supabase as any)
      .from("lead_tarefas")
      .select("*")
      .eq("lead_id", leadId)
      .order("status", { ascending: true })
      .order("prazo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    setTarefas((data ?? []) as Tarefa[]);
  }

  useEffect(() => { load(); }, [leadId]);

  async function criar() {
    if (!titulo.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from("lead_tarefas").insert({
      tenant_id: tenantId,
      lead_id: leadId,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      tipo, prioridade,
      prazo: prazo ? new Date(prazo).toISOString() : null,
      responsavel_user_id: user?.id ?? null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setTitulo(""); setDescricao(""); setPrazo(""); setOpen(false);
    load();
  }

  async function toggle(t: Tarefa) {
    const novo = t.status === "concluida" ? "pendente" : "concluida";
    const { error } = await (supabase as any).from("lead_tarefas").update({
      status: novo,
      concluida_em: novo === "concluida" ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir tarefa?")) return;
    const { error } = await (supabase as any).from("lead_tarefas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const now = new Date();

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tarefas e lembretes</h2>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          <Plus className="mr-1 h-4 w-4" /> Nova
        </Button>
      </div>

      {open && (
        <div className="mb-4 space-y-2 rounded-lg border border-dashed p-3">
          <Input placeholder="Título da tarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />
          <Textarea rows={2} placeholder="Detalhes (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={2000} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={prioridade} onValueChange={setPrioridade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORIDADES.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={criar} disabled={saving || !titulo.trim()}>{saving ? "Salvando…" : "Adicionar"}</Button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {tarefas.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma tarefa.</li>}
        {tarefas.map((t) => {
          const atrasada = t.status === "pendente" && t.prazo && new Date(t.prazo) < now;
          return (
            <li key={t.id} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${t.status === "concluida" ? "opacity-60" : ""}`}>
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
                {t.descricao && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{t.descricao}</p>}
                {t.prazo && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prazo: {new Date(t.prazo).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}