import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, List, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/app/visitas")({
  head: () => ({ meta: [{ title: "Visitas — imob365" }] }),
  component: VisitasPage,
});

function MonthView({ mesRef, onPrev, onNext, items }: {
  mesRef: Date; onPrev: () => void; onNext: () => void; items: any[];
}) {
  const year = mesRef.getFullYear();
  const month = mesRef.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: ({ day: number; date: string } | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, date });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const byDate = new Map<string, any[]>();
  for (const v of items) {
    const dObj = new Date(v.data_hora);
    const k = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`;
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(v);
  }

  const todayObj = new Date();
  const todayKey = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
  const titulo = mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onPrev} className="rounded px-3 py-1 text-sm hover:bg-muted">←</button>
        <h2 className="text-sm font-semibold capitalize">{titulo}</h2>
        <button onClick={onNext} className="rounded px-3 py-1 text-sm hover:bg-muted">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => <div key={d} className="py-1 font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="aspect-square rounded-md bg-muted/30" />;
          const vs = byDate.get(c.date) ?? [];
          const isToday = c.date === todayKey;
          return (
            <div key={i} className={`aspect-square rounded-md border p-1 text-left text-xs ${isToday ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
              <div className={`text-[10px] ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>{c.day}</div>
              <div className="mt-0.5 space-y-0.5 overflow-hidden">
                {vs.slice(0, 2).map((v) => (
                  <div key={v.id} className="truncate rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary">
                    {new Date(v.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {v.imovel?.titulo ?? ""}
                  </div>
                ))}
                {vs.length > 2 && <div className="text-[9px] text-muted-foreground">+{vs.length - 2} mais</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  nao_compareceu: "Não compareceu",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  agendada: "secondary",
  confirmada: "default",
  realizada: "default",
  cancelada: "outline",
  nao_compareceu: "destructive",
};

function VisitasPage() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [corretores, setCorretores] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"lista" | "mes">("lista");
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [form, setForm] = useState({
    imovel_id: "",
    corretor_id: "",
    lead_id: "",
    data: "",
    hora: "",
    duracao_min: 30,
    observacoes: "",
  });
  const [showForm, setShowForm] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: v }, { data: i }, { data: c }, { data: l }] = await Promise.all([
      supabase
        .from("visitas")
        .select("*,imovel:imoveis(id,titulo),corretor:corretores(id,nome),lead:leads(id,nome)")
        .order("data_hora", { ascending: true }),
      supabase.from("imoveis").select("id,titulo").order("titulo"),
      supabase.from("corretores").select("id,nome").eq("ativo", true).order("nome"),
      supabase.from("leads").select("id,nome").order("created_at", { ascending: false }).limit(100),
    ]);
    setItems(v ?? []);
    setImoveis(i ?? []);
    setCorretores(c ?? []);
    setLeads(l ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  async function add() {
    if (!tenantId || !form.imovel_id || !form.data || !form.hora) {
      toast.error("Preencha imóvel, data e hora.");
      return;
    }
    const data_hora = new Date(`${form.data}T${form.hora}:00`).toISOString();
    const { error } = await supabase.from("visitas").insert({
      tenant_id: tenantId,
      imovel_id: form.imovel_id,
      corretor_id: form.corretor_id || null,
      lead_id: form.lead_id || null,
      data_hora,
      duracao_min: Number(form.duracao_min) || 30,
      observacoes: form.observacoes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Visita agendada");
    setShowForm(false);
    setForm({ imovel_id: "", corretor_id: "", lead_id: "", data: "", hora: "", duracao_min: 30, observacoes: "" });
    load();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("visitas").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir visita?")) return;
    await supabase.from("visitas").delete().eq("id", id);
    load();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const v of items) {
      // FIX [QA-01]: Não usar .toISOString().slice(0,10) — converte para UTC e desloca
      // datas após 21h no fuso America/Sao_Paulo (UTC-3) para o dia seguinte.
      // Usar getters locais do objeto Date preserva o fuso do navegador do corretor.
      const d = new Date(v.data_hora);
      const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(dia)) map.set(dia, []);
      map.get(dia)!.push(v);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visitas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agenda de visitas aos imóveis.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            <button onClick={() => setView("lista")}
              className={`flex items-center gap-1 rounded px-3 py-1 text-xs ${view === "lista" ? "bg-muted font-medium" : "text-muted-foreground"}`}>
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button onClick={() => setView("mes")}
              className={`flex items-center gap-1 rounded px-3 py-1 text-xs ${view === "mes" ? "bg-muted font-medium" : "text-muted-foreground"}`}>
              <Calendar className="h-3.5 w-3.5" /> Mês
            </button>
          </div>
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="mr-2 h-4 w-4" /> Nova visita
          </Button>
        </div>
      </header>

      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-card p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Imóvel *</Label>
              <Select value={form.imovel_id} onValueChange={(v) => setForm({ ...form, imovel_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {imoveis.map((i) => <SelectItem key={i.id} value={i.id}>{i.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Corretor</Label>
              <Select value={form.corretor_id} onValueChange={(v) => setForm({ ...form, corretor_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {corretores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lead</Label>
              <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
              <div>
                <Label>Hora *</Label>
                <Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
              </div>
              <div>
                <Label>Duração</Label>
                <Input type="number" min={10} step={5} value={form.duracao_min}
                  onChange={(e) => setForm({ ...form, duracao_min: Number(e.target.value) })} />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={add}>Agendar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : view === "mes" ? (
        <MonthView
          mesRef={mesRef}
          onPrev={() => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1))}
          onNext={() => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 1))}
          items={items}
        />
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma visita agendada.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dia, vs]) => (
            <section key={dia}>
              <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                {new Date(dia + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </h2>
              <div className="space-y-2">
                {vs.map((v) => (
                  <div key={v.id} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {new Date(v.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="font-medium">{v.imovel?.titulo ?? "—"}</span>
                        <Badge variant={STATUS_VARIANT[v.status]}>{STATUS_LABEL[v.status]}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {v.duracao_min}min · {v.corretor?.nome ?? "sem corretor"} · {v.lead?.nome ?? "sem lead"}
                      </div>
                      {v.observacoes && <div className="mt-1 text-xs text-muted-foreground">{v.observacoes}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Select value={v.status} onValueChange={(s) => setStatus(v.id, s)}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABEL).map(([k, l]) => (
                            <SelectItem key={k} value={k}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => remove(v.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}