import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Plus,
  Settings2,
  X,
  AlertCircle,
  Mail,
  Phone,
  Route as RouteIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/app/parceiros-comerciais")({
  head: () => ({ meta: [{ title: "Parceiros Comerciais — imob365" }] }),
  component: ParceirosComerciaisPage,
});

type Etapa = { id: string; nome: string; ordem: number; cor: string | null };
type Parceiro = {
  id: string;
  nome_empresa: string | null;
  nome_contato: string | null;
  tipo: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  canal_contato: string | null;
  observacoes: string | null;
  etapa_id: string | null;
};
type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prazo: string | null;
  parceiro_id: string | null;
};

const ETAPAS_PADRAO = [
  "Novo Contato",
  "Em Conversa",
  "Aguardando Retorno",
  "Parceria Ativa",
  "Sem Interesse",
];

const TIPOS = [
  { v: "construtora", label: "Construtora" },
  { v: "imobiliaria", label: "Imobiliária / Rede" },
  { v: "portal", label: "Portal" },
  { v: "outro", label: "Outro" },
];

const CANAIS = [
  { v: "whatsapp", label: "WhatsApp" },
  { v: "email", label: "E-mail" },
  { v: "telefone", label: "Telefone" },
  { v: "formulario", label: "Formulário" },
  { v: "presencial", label: "Presencial" },
];

function nomeParceiro(p: { nome_empresa: string | null; nome_contato: string | null }) {
  return p.nome_empresa || p.nome_contato || "—";
}

const NOVO_PARCEIRO_INICIAL = {
  nome_empresa: "",
  nome_contato: "",
  tipo: "construtora",
  cargo: "",
  telefone: "",
  email: "",
  canal_contato: "",
  observacoes: "",
};

const NOVA_TAREFA_INICIAL = {
  titulo: "",
  descricao: "",
  prazo: "",
};

function ParceirosComerciaisPage() {
  const { tenantId, isAdmin } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [gerenciarColunas, setGerenciarColunas] = useState(false);
  const [novaEtapa, setNovaEtapa] = useState("");

  const [showNovoParceiro, setShowNovoParceiro] = useState(false);
  const [novoParceiro, setNovoParceiro] = useState(NOVO_PARCEIRO_INICIAL);
  const [salvandoParceiro, setSalvandoParceiro] = useState(false);

  const [selecionado, setSelecionado] = useState<Parceiro | null>(null);
  const [novaTarefa, setNovaTarefa] = useState(NOVA_TAREFA_INICIAL);
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);

  async function seedEtapasPadrao() {
    if (!tenantId) return;
    const rows = ETAPAS_PADRAO.map((nome, i) => ({ tenant_id: tenantId, nome, ordem: i }));
    await (supabase as any).from("parceiro_etapas").insert(rows);
  }

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    let etapasList: Etapa[] = [];
    const { data: et } = await (supabase as any)
      .from("parceiro_etapas")
      .select("id,nome,ordem,cor")
      .eq("tenant_id", tenantId)
      .order("ordem");
    etapasList = (et as Etapa[]) ?? [];
    if (etapasList.length === 0) {
      await seedEtapasPadrao();
      const { data: reload } = await (supabase as any)
        .from("parceiro_etapas")
        .select("id,nome,ordem,cor")
        .eq("tenant_id", tenantId)
        .order("ordem");
      etapasList = (reload as Etapa[]) ?? [];
    }
    setEtapas(etapasList);

    const [{ data: ps }, { data: ts }] = await Promise.all([
      (supabase as any)
        .from("parceiros_comerciais")
        .select(
          "id,nome_empresa,nome_contato,tipo,cargo,telefone,email,canal_contato,observacoes,etapa_id",
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("lead_tarefas")
        .select("id,titulo,descricao,status,prazo,parceiro_id")
        .eq("tenant_id", tenantId)
        .not("parceiro_id", "is", null)
        .order("prazo", { ascending: true, nullsFirst: false }),
    ]);
    setParceiros((ps as Parceiro[]) ?? []);
    setTarefas((ts as Tarefa[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  // Tarefa pendente mais próxima por parceiro — tarefas já vêm ordenadas
  // por prazo asc, então o primeiro pendente encontrado por parceiro_id é
  // sempre o mais próximo.
  const proximaTarefaPorParceiro = useMemo(() => {
    const map = new Map<string, Tarefa>();
    for (const t of tarefas) {
      if (t.status !== "pendente" || !t.parceiro_id) continue;
      if (!map.has(t.parceiro_id)) map.set(t.parceiro_id, t);
    }
    return map;
  }, [tarefas]);

  async function moveTo(id: string, etapaId: string | null) {
    const prev = parceiros.find((p) => p.id === id);
    if (!prev || prev.etapa_id === etapaId) return;
    setParceiros((arr) => arr.map((p) => (p.id === id ? { ...p, etapa_id: etapaId } : p)));
    const { error } = await (supabase as any)
      .from("parceiros_comerciais")
      .update({ etapa_id: etapaId })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  }

  async function criarParceiro() {
    if (!tenantId) return;
    if (!novoParceiro.nome_empresa.trim() && !novoParceiro.nome_contato.trim()) {
      toast.error("Informe a empresa ou o nome do contato.");
      return;
    }
    setSalvandoParceiro(true);
    const { error } = await (supabase as any).from("parceiros_comerciais").insert({
      tenant_id: tenantId,
      nome_empresa: novoParceiro.nome_empresa.trim() || null,
      nome_contato: novoParceiro.nome_contato.trim() || null,
      tipo: novoParceiro.tipo,
      cargo: novoParceiro.cargo.trim() || null,
      telefone: novoParceiro.telefone.trim() || null,
      email: novoParceiro.email.trim() || null,
      canal_contato: novoParceiro.canal_contato || null,
      observacoes: novoParceiro.observacoes.trim() || null,
      etapa_id: etapas[0]?.id ?? null,
    });
    setSalvandoParceiro(false);
    if (error) return toast.error(error.message);
    toast.success("Parceiro adicionado");
    setShowNovoParceiro(false);
    setNovoParceiro(NOVO_PARCEIRO_INICIAL);
    load();
  }

  async function addEtapa() {
    if (!novaEtapa.trim() || !tenantId) return;
    const ordem = etapas.length;
    const { error } = await (supabase as any)
      .from("parceiro_etapas")
      .insert({ tenant_id: tenantId, nome: novaEtapa.trim(), ordem });
    if (error) return toast.error(error.message);
    setNovaEtapa("");
    load();
  }

  async function renomearEtapa(id: string, nome: string) {
    await (supabase as any).from("parceiro_etapas").update({ nome }).eq("id", id);
    load();
  }

  async function excluirEtapa(id: string) {
    if (!(await confirmDialog('Excluir esta coluna? Os parceiros nela vão para "Sem etapa".')))
      return;
    await (supabase as any).from("parceiro_etapas").delete().eq("id", id);
    load();
  }

  function abrirDetalhe(p: Parceiro) {
    setSelecionado(p);
    setNovaTarefa(NOVA_TAREFA_INICIAL);
  }

  async function registrarInteracao() {
    if (!selecionado || !tenantId) return;
    if (!novaTarefa.titulo.trim()) {
      toast.error("Descreva a interação.");
      return;
    }
    setSalvandoTarefa(true);
    const { error } = await (supabase as any).from("lead_tarefas").insert({
      tenant_id: tenantId,
      parceiro_id: selecionado.id,
      titulo: novaTarefa.titulo.trim(),
      descricao: novaTarefa.descricao.trim() || null,
      tipo: "tarefa",
      prioridade: "media",
      prazo: novaTarefa.prazo ? new Date(novaTarefa.prazo).toISOString() : null,
    });
    setSalvandoTarefa(false);
    if (error) return toast.error(error.message);
    toast.success("Interação registrada");
    setNovaTarefa(NOVA_TAREFA_INICIAL);
    load();
  }

  const tarefasDoSelecionado = selecionado
    ? tarefas.filter((t) => t.parceiro_id === selecionado.id)
    : [];

  return (
    <div className="p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Briefcase className="h-7 w-7 text-primary" />
            Parceiros Comerciais
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Construtoras, incorporadoras, redes e portais — acompanhe cada contato até virar
            parceria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setGerenciarColunas((s) => !s)}>
              <Settings2 className="mr-2 h-4 w-4" /> Gerenciar colunas
            </Button>
          )}
          <Button onClick={() => setShowNovoParceiro(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Parceiro
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

      {loading ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div
          className="mt-6 grid gap-3 overflow-x-auto"
          style={{ gridTemplateColumns: `repeat(${etapas.length + 1}, minmax(240px, 1fr))` }}
        >
          {etapas.map((etapa) => {
            const cards = parceiros.filter((p) => p.etapa_id === etapa.id);
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
                  {cards.map((p) => (
                    <ParceiroCard
                      key={p.id}
                      parceiro={p}
                      proximaTarefa={proximaTarefaPorParceiro.get(p.id)}
                      onDragStart={() => setDragId(p.id)}
                      onClick={() => abrirDetalhe(p)}
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
                {parceiros.filter((p) => !p.etapa_id).length}
              </span>
            </div>
            <div className="space-y-2">
              {parceiros
                .filter((p) => !p.etapa_id)
                .map((p) => (
                  <ParceiroCard
                    key={p.id}
                    parceiro={p}
                    proximaTarefa={proximaTarefaPorParceiro.get(p.id)}
                    onDragStart={() => setDragId(p.id)}
                    onClick={() => abrirDetalhe(p)}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      <Dialog open={showNovoParceiro} onOpenChange={setShowNovoParceiro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Parceiro Comercial</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Empresa
              </Label>
              <Input
                value={novoParceiro.nome_empresa}
                onChange={(e) => setNovoParceiro((f) => ({ ...f, nome_empresa: e.target.value }))}
                placeholder="Ex.: Construtora Martino"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nome do contato
              </Label>
              <Input
                value={novoParceiro.nome_contato}
                onChange={(e) => setNovoParceiro((f) => ({ ...f, nome_contato: e.target.value }))}
                placeholder="Ex.: Ana Paula"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tipo
              </Label>
              <Select
                value={novoParceiro.tipo}
                onValueChange={(v) => setNovoParceiro((f) => ({ ...f, tipo: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cargo
              </Label>
              <Input
                value={novoParceiro.cargo}
                onChange={(e) => setNovoParceiro((f) => ({ ...f, cargo: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Telefone
              </Label>
              <Input
                value={novoParceiro.telefone}
                onChange={(e) => setNovoParceiro((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                E-mail
              </Label>
              <Input
                type="email"
                value={novoParceiro.email}
                onChange={(e) => setNovoParceiro((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Canal usado
              </Label>
              <Select
                value={novoParceiro.canal_contato || undefined}
                onValueChange={(v) => setNovoParceiro((f) => ({ ...f, canal_contato: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS.map((c) => (
                    <SelectItem key={c.v} value={c.v}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Observações
              </Label>
              <Textarea
                rows={2}
                value={novoParceiro.observacoes}
                onChange={(e) => setNovoParceiro((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Ex.: enviei formulário on-line, aguardando retorno"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovoParceiro(false)}>
              Cancelar
            </Button>
            <Button onClick={criarParceiro} disabled={salvandoParceiro}>
              {salvandoParceiro ? "Salvando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selecionado} onOpenChange={(open) => !open && setSelecionado(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selecionado && (
            <>
              <DialogHeader>
                <DialogTitle>{nomeParceiro(selecionado)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                  {selecionado.nome_contato && selecionado.nome_empresa && (
                    <span>{selecionado.nome_contato}</span>
                  )}
                  {selecionado.cargo && <span>· {selecionado.cargo}</span>}
                  {selecionado.telefone && (
                    <a
                      href={`tel:${selecionado.telefone}`}
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <Phone className="h-3.5 w-3.5" /> {selecionado.telefone}
                    </a>
                  )}
                  {selecionado.email && (
                    <a
                      href={`mailto:${selecionado.email}`}
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <Mail className="h-3.5 w-3.5" /> {selecionado.email}
                    </a>
                  )}
                </div>
                {selecionado.observacoes && (
                  <p className="rounded-lg bg-muted/50 p-3 text-xs">{selecionado.observacoes}</p>
                )}

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Interações e tarefas
                  </h3>
                  {tarefasDoSelecionado.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma interação registrada.</p>
                  ) : (
                    <ul className="space-y-2">
                      {tarefasDoSelecionado.map((t) => {
                        const atrasada =
                          t.status === "pendente" && t.prazo && new Date(t.prazo) < new Date();
                        return (
                          <li
                            key={t.id}
                            className="flex items-start justify-between gap-2 rounded-lg border border-border p-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={
                                    t.status === "concluida" ? "line-through" : "font-medium"
                                  }
                                >
                                  {t.titulo}
                                </span>
                                {atrasada && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-500 text-[10px] text-amber-600"
                                  >
                                    <AlertCircle className="mr-1 h-3 w-3" /> atrasada
                                  </Badge>
                                )}
                              </div>
                              {t.prazo && (
                                <div className="text-xs text-muted-foreground">
                                  {new Date(t.prazo).toLocaleString("pt-BR")}
                                </div>
                              )}
                            </div>
                            <Link
                              to="/app/roteiro-visitas"
                              search={{ leadId: undefined, taskId: t.id }}
                              title="Gerar visita a partir desta tarefa"
                              className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary"
                            >
                              <RouteIcon className="h-4 w-4" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-dashed border-border p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Registrar nova interação
                  </h3>
                  <div className="space-y-2">
                    <Input
                      value={novaTarefa.titulo}
                      onChange={(e) => setNovaTarefa((f) => ({ ...f, titulo: e.target.value }))}
                      placeholder="Ex.: Enviei e-mail, aguardando retorno"
                    />
                    <Textarea
                      rows={2}
                      value={novaTarefa.descricao}
                      onChange={(e) => setNovaTarefa((f) => ({ ...f, descricao: e.target.value }))}
                      placeholder="Detalhes (opcional)"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="datetime-local"
                        className="max-w-[220px]"
                        value={novaTarefa.prazo}
                        onChange={(e) => setNovaTarefa((f) => ({ ...f, prazo: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        onClick={registrarInteracao}
                        disabled={salvandoTarefa}
                        className="ml-auto"
                      >
                        {salvandoTarefa ? "Salvando…" : "Registrar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  );
}

function ParceiroCard({
  parceiro,
  proximaTarefa,
  onDragStart,
  onClick,
}: {
  parceiro: Parceiro;
  proximaTarefa: Tarefa | undefined;
  onDragStart: () => void;
  onClick: () => void;
}) {
  const atrasada = proximaTarefa?.prazo && new Date(proximaTarefa.prazo) < new Date();
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-grab rounded-lg border border-border bg-card p-3 text-sm shadow-sm hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="line-clamp-1 font-medium">{nomeParceiro(parceiro)}</span>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {TIPOS.find((t) => t.v === parceiro.tipo)?.label ?? parceiro.tipo}
        </Badge>
      </div>
      {parceiro.nome_empresa && parceiro.nome_contato && (
        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {parceiro.nome_contato}
        </div>
      )}
      {proximaTarefa && (
        <div
          className={`mt-2 flex items-center gap-1 text-[11px] ${atrasada ? "font-medium text-rose-600" : "text-muted-foreground"}`}
        >
          {atrasada && <AlertCircle className="h-3 w-3" />}
          {proximaTarefa.titulo}
          {proximaTarefa.prazo && (
            <span>· {new Date(proximaTarefa.prazo).toLocaleDateString("pt-BR")}</span>
          )}
        </div>
      )}
    </div>
  );
}
