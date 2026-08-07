import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Route as RouteIcon, Plus, Settings2, X, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/roteiro-visitas")({
  head: () => ({ meta: [{ title: "Roteiro de Visitas — imob365" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    leadId: typeof search.leadId === "string" ? search.leadId : undefined,
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
  component: RoteiroVisitasPage,
});

type Etapa = { id: string; nome: string; ordem: number; cor: string | null };
type Visita = {
  id: string;
  imovel_id: string;
  corretor_id: string | null;
  lead_id: string | null;
  data_hora: string;
  duracao_min: number;
  observacoes: string | null;
  roteiro_etapa_id: string | null;
  imovel?: { id: string; titulo: string } | null;
  corretor?: { id: string; nome: string } | null;
  lead?: { id: string; nome: string } | null;
};

const ETAPAS_PADRAO = [
  "A visitar",
  "Em rota",
  "Realizada",
  "Feedback registrado",
  "Não compareceu/Cancelada",
];

function inicioFim() {
  const agora = new Date();
  const inicio = new Date(agora);
  inicio.setDate(inicio.getDate() - 7);
  const fim = new Date(agora);
  fim.setDate(fim.getDate() + 30);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

function RoteiroVisitasPage() {
  const { tenantId, user, isAdmin } = useAuth();
  const { leadId, taskId } = Route.useSearch();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [meuCorretorId, setMeuCorretorId] = useState<string | null>(null);
  const [corretores, setCorretores] = useState<{ id: string; nome: string }[]>([]);
  const [filtroCorretorId, setFiltroCorretorId] = useState<string>("");
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [gerenciarColunas, setGerenciarColunas] = useState(false);
  const [novaEtapa, setNovaEtapa] = useState("");

  const [dialogVisita, setDialogVisita] = useState<Visita | null>(null);
  const [obsEdit, setObsEdit] = useState("");
  const [salvandoObs, setSalvandoObs] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [imoveis, setImoveis] = useState<{ id: string; titulo: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; nome: string }[]>([]);
  const [form, setForm] = useState({
    imovel_id: "",
    corretor_id: "",
    lead_id: "",
    data: "",
    hora: "",
    observacoes: "",
  });

  async function seedEtapasPadrao() {
    if (!tenantId) return;
    const rows = ETAPAS_PADRAO.map((nome, i) => ({ tenant_id: tenantId, nome, ordem: i }));
    await (supabase as any).from("roteiro_visita_etapas").insert(rows);
  }

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { inicio, fim } = inicioFim();
    const [{ data: cor }, { data: et }, { data: v }, { data: i }, { data: l }] = await Promise.all([
      (supabase as any).from("corretores").select("id,nome,user_id").eq("tenant_id", tenantId),
      (supabase as any)
        .from("roteiro_visita_etapas")
        .select("id,nome,ordem,cor")
        .eq("tenant_id", tenantId)
        .order("ordem"),
      supabase
        .from("visitas")
        .select(
          "id,imovel_id,corretor_id,lead_id,data_hora,duracao_min,observacoes,roteiro_etapa_id,imovel:imoveis(id,titulo),corretor:corretores(id,nome),lead:leads(id,nome)",
        )
        .gte("data_hora", inicio)
        .lte("data_hora", fim)
        .order("data_hora", { ascending: true }),
      supabase.from("imoveis").select("id,titulo").order("titulo"),
      supabase.from("leads").select("id,nome").order("created_at", { ascending: false }).limit(100),
    ]);
    const corretoresList = (cor as { id: string; nome: string; user_id: string | null }[]) ?? [];
    setCorretores(corretoresList.map((c) => ({ id: c.id, nome: c.nome })));
    const proprio = corretoresList.find((c) => c.user_id === user?.id);
    setMeuCorretorId(proprio?.id ?? null);
    setImoveis(i ?? []);
    setLeads(l ?? []);

    let etapasList = (et as Etapa[]) ?? [];
    if (etapasList.length === 0) {
      await seedEtapasPadrao();
      const { data: reload } = await (supabase as any)
        .from("roteiro_visita_etapas")
        .select("id,nome,ordem,cor")
        .eq("tenant_id", tenantId)
        .order("ordem");
      etapasList = (reload as Etapa[]) ?? [];
    }
    setEtapas(etapasList);
    setVisitas((v as unknown as Visita[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  // Chegou aqui a partir de "Agendar visita" no detalhe de um lead
  // (app.leads.$id.tsx) — pré-preenche e já abre o formulário de nova
  // visita com o lead (e imóvel/corretor dele, se já atribuídos).
  useEffect(() => {
    if (!leadId || !tenantId) return;
    (async () => {
      const { data: lead } = await (supabase as any)
        .from("leads")
        .select("id,nome,imovel_id,corretor_id")
        .eq("id", leadId)
        .maybeSingle();
      if (!lead) return;
      setLeads((prev) => (prev.some((l) => l.id === lead.id) ? prev : [lead, ...prev]));
      setForm((f) => ({
        ...f,
        lead_id: lead.id,
        imovel_id: lead.imovel_id ?? f.imovel_id,
        corretor_id: lead.corretor_id ?? f.corretor_id,
      }));
      setShowForm(true);
    })();
  }, [leadId, tenantId]);

  // Chegou aqui a partir de "Gerar visita" numa tarefa (app.tarefas.tsx ou
  // o dialog de um parceiro comercial) — pré-preenche a observação com o
  // título/descrição da tarefa e o lead, se a tarefa tiver um. Diferente do
  // efeito de leadId acima: uma tarefa não carrega imovel_id/corretor_id,
  // então esses campos ficam por conta do usuário escolher.
  useEffect(() => {
    if (!taskId || !tenantId) return;
    (async () => {
      const { data: tarefa } = await (supabase as any)
        .from("lead_tarefas")
        .select("id,titulo,descricao,lead_id,lead:leads(id,nome)")
        .eq("id", taskId)
        .maybeSingle();
      if (!tarefa) return;
      if (tarefa.lead) {
        setLeads((prev) =>
          prev.some((l) => l.id === tarefa.lead.id) ? prev : [tarefa.lead, ...prev],
        );
      }
      const observacoes = [tarefa.titulo, tarefa.descricao].filter(Boolean).join(" — ");
      setForm((f) => ({
        ...f,
        lead_id: tarefa.lead_id ?? f.lead_id,
        observacoes: observacoes || f.observacoes,
      }));
      setShowForm(true);
    })();
  }, [taskId, tenantId]);

  const escopoCorretorId = isAdmin ? filtroCorretorId : (meuCorretorId ?? "");
  const visitasEscopo = useMemo(() => {
    if (!escopoCorretorId) return visitas;
    return visitas.filter((v) => v.corretor_id === escopoCorretorId);
  }, [visitas, escopoCorretorId]);

  async function moveTo(id: string, etapaId: string | null) {
    const prev = visitas.find((v) => v.id === id);
    if (!prev || prev.roteiro_etapa_id === etapaId) return;
    setVisitas((arr) => arr.map((v) => (v.id === id ? { ...v, roteiro_etapa_id: etapaId } : v)));
    const { error } = await (supabase as any)
      .from("visitas")
      .update({ roteiro_etapa_id: etapaId })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  }

  function abrirDialog(v: Visita) {
    setDialogVisita(v);
    setObsEdit(v.observacoes ?? "");
  }

  async function salvarObs() {
    if (!dialogVisita) return;
    setSalvandoObs(true);
    const { error } = await supabase
      .from("visitas")
      .update({ observacoes: obsEdit || null })
      .eq("id", dialogVisita.id);
    setSalvandoObs(false);
    if (error) return toast.error(error.message);
    toast.success("Registro salvo");
    setVisitas((arr) =>
      arr.map((v) => (v.id === dialogVisita.id ? { ...v, observacoes: obsEdit || null } : v)),
    );
    setDialogVisita(null);
  }

  async function addEtapa() {
    if (!novaEtapa.trim() || !tenantId) return;
    const ordem = etapas.length;
    const { error } = await (supabase as any)
      .from("roteiro_visita_etapas")
      .insert({ tenant_id: tenantId, nome: novaEtapa.trim(), ordem });
    if (error) return toast.error(error.message);
    setNovaEtapa("");
    load();
  }

  async function renomearEtapa(id: string, nome: string) {
    await (supabase as any).from("roteiro_visita_etapas").update({ nome }).eq("id", id);
    load();
  }

  async function excluirEtapa(id: string) {
    if (!(await confirmDialog('Excluir esta coluna? As visitas nela vão para "Sem etapa".')))
      return;
    await (supabase as any).from("roteiro_visita_etapas").delete().eq("id", id);
    load();
  }

  async function criarVisita() {
    if (!tenantId || !form.imovel_id || !form.data || !form.hora) {
      toast.error("Preencha imóvel, data e hora.");
      return;
    }
    const data_hora = new Date(`${form.data}T${form.hora}:00`).toISOString();
    const primeiraEtapa = etapas[0]?.id ?? null;
    const corretorId = form.corretor_id || meuCorretorId || null;
    const { error } = await supabase.from("visitas").insert({
      tenant_id: tenantId,
      imovel_id: form.imovel_id,
      corretor_id: corretorId,
      lead_id: form.lead_id || null,
      data_hora,
      observacoes: form.observacoes || null,
      roteiro_etapa_id: primeiraEtapa,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Visita criada");
    setShowForm(false);
    setForm({ imovel_id: "", corretor_id: "", lead_id: "", data: "", hora: "", observacoes: "" });
    load();
  }

  return (
    <div className="p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <RouteIcon className="h-7 w-7 text-primary" />
            Roteiro de Visitas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste os cards entre as colunas pra acompanhar cada visita, do agendamento ao
            feedback.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Select
              value={filtroCorretorId || "todos"}
              onValueChange={(v) => setFiltroCorretorId(v === "todos" ? "" : v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os corretores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os corretores</SelectItem>
                {corretores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setGerenciarColunas((s) => !s)}>
              <Settings2 className="mr-2 h-4 w-4" /> Gerenciar colunas
            </Button>
          )}
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="mr-2 h-4 w-4" /> Nova visita
          </Button>
        </div>
      </header>

      {gerenciarColunas && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Colunas do quadro</h2>
          <div className="flex flex-wrap gap-2">
            {etapas.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1"
              >
                <Input
                  defaultValue={e.nome}
                  onBlur={(ev) =>
                    ev.target.value !== e.nome && renomearEtapa(e.id, ev.target.value)
                  }
                  className="h-7 w-40 border-none px-1 text-sm shadow-none focus-visible:ring-0"
                />
                <button
                  onClick={() => excluirEtapa(e.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex max-w-xs gap-2">
            <Input
              placeholder="Nova coluna"
              value={novaEtapa}
              onChange={(e) => setNovaEtapa(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEtapa()}
            />
            <Button size="sm" onClick={addEtapa}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mt-4 rounded-xl border border-border bg-card p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Imóvel *</Label>
              <Select
                value={form.imovel_id}
                onValueChange={(v) => setForm({ ...form, imovel_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {imoveis.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lead</Label>
              <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div>
                <Label>Corretor</Label>
                <Select
                  value={form.corretor_id}
                  onValueChange={(v) => setForm({ ...form, corretor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Você" />
                  </SelectTrigger>
                  <SelectContent>
                    {corretores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <div>
                <Label>Hora *</Label>
                <Input
                  type="time"
                  value={form.hora}
                  onChange={(e) => setForm({ ...form, hora: e.target.value })}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={criarVisita}>Criar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div
          className="mt-6 grid gap-3 overflow-x-auto"
          style={{ gridTemplateColumns: `repeat(${etapas.length + 1}, minmax(240px, 1fr))` }}
        >
          {etapas.map((etapa) => {
            const cards = visitasEscopo.filter((v) => v.roteiro_etapa_id === etapa.id);
            return (
              <div
                key={etapa.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) {
                    moveTo(dragId, etapa.id);
                    setDragId(null);
                  }
                }}
                className="flex min-h-[240px] flex-col rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {etapa.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((v) => (
                    <VisitaCard
                      key={v.id}
                      v={v}
                      mostrarCorretor={isAdmin && !escopoCorretorId}
                      onDragStart={() => setDragId(v.id)}
                      onClick={() => abrirDialog(v)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) {
                moveTo(dragId, null);
                setDragId(null);
              }
            }}
            className="flex min-h-[240px] flex-col rounded-xl border border-dashed border-border bg-muted/10 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Sem etapa
              </span>
              <span className="text-xs text-muted-foreground">
                {visitasEscopo.filter((v) => !v.roteiro_etapa_id).length}
              </span>
            </div>
            <div className="space-y-2">
              {visitasEscopo
                .filter((v) => !v.roteiro_etapa_id)
                .map((v) => (
                  <VisitaCard
                    key={v.id}
                    v={v}
                    mostrarCorretor={isAdmin && !escopoCorretorId}
                    onDragStart={() => setDragId(v.id)}
                    onClick={() => abrirDialog(v)}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!dialogVisita} onOpenChange={(open) => !open && setDialogVisita(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogVisita?.imovel?.titulo ?? "Visita"}</DialogTitle>
          </DialogHeader>
          {dialogVisita && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {new Date(dialogVisita.data_hora).toLocaleString("pt-BR")}
              </p>
              {dialogVisita.lead && (
                <p>
                  Lead:{" "}
                  <Link
                    to="/app/leads/$id"
                    params={{ id: dialogVisita.lead.id }}
                    className="text-primary hover:underline"
                  >
                    {dialogVisita.lead.nome}
                  </Link>
                </p>
              )}
              {dialogVisita.corretor && <p>Corretor: {dialogVisita.corretor.nome}</p>}
              <div>
                <Label>Registro da visita</Label>
                <Textarea
                  rows={5}
                  value={obsEdit}
                  onChange={(e) => setObsEdit(e.target.value)}
                  placeholder="Feedback, impressões, próximos passos…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogVisita(null)}>
              Fechar
            </Button>
            <Button onClick={salvarObs} disabled={salvandoObs}>
              {salvandoObs ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  );
}

function VisitaCard({
  v,
  mostrarCorretor,
  onDragStart,
  onClick,
}: {
  v: Visita;
  mostrarCorretor: boolean;
  onDragStart: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-grab rounded-lg border border-border bg-card p-3 text-sm shadow-sm hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-primary">
          {new Date(v.data_hora).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="mt-1 line-clamp-1 font-medium">{v.imovel?.titulo ?? "—"}</div>
      {v.lead && (
        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">Lead: {v.lead.nome}</div>
      )}
      {mostrarCorretor && v.corretor && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <User className="h-3 w-3" /> {v.corretor.nome}
        </div>
      )}
    </div>
  );
}
