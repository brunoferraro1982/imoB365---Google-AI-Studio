import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronRight,
  Plus,
  Route as RouteIcon,
  Briefcase,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
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
import { isTarefaAtrasada, isTarefaHoje } from "@/lib/tarefasHelpers";

export const Route = createFileRoute("/app/tarefas")({
  component: TarefasPage,
});

type Tarefa = {
  id: string;
  lead_id: string | null;
  contrato_id: string | null;
  cartorio_registro_id: string | null;
  parceiro_id: string | null;
  titulo: string;
  tipo: string;
  prioridade: string;
  status: string;
  prazo: string | null;
  created_at: string;
  lead?: { nome: string; id: string } | null;
  contrato?: { id: string; numero: string | null } | null;
  cartorio_registro?: { id: string; tipo: string; cartorio_nome: string | null } | null;
  parceiro?: { id: string; nome_empresa: string | null; nome_contato: string | null } | null;
};

type Parceiro = { id: string; nome_empresa: string | null; nome_contato: string | null };

const TIPOS = [
  { v: "tarefa", label: "Tarefa" },
  { v: "ligacao", label: "Ligação" },
  { v: "whatsapp", label: "WhatsApp" },
  { v: "email", label: "E-mail" },
  { v: "reuniao", label: "Reunião" },
];

const NOVO_PARCEIRO = "__novo__";
const SEM_PARCEIRO = "__nenhum__";

function nomeParceiro(p: Parceiro | null | undefined) {
  if (!p) return "";
  return p.nome_empresa || p.nome_contato || "";
}

const FORM_INICIAL = {
  tipo: "tarefa",
  parceiroId: SEM_PARCEIRO,
  novoParceiroNome: "",
  novoParceiroContato: "",
  novoParceiroCargo: "",
  novoParceiroTelefone: "",
  novoParceiroEmail: "",
  novoParceiroCanal: "",
  titulo: "",
  descricao: "",
  prazo: "",
  prioridade: "media",
};

function TarefasPage() {
  const { tenantId, user } = useAuth();
  const [filtro, setFiltro] = useState<"minhas" | "todas" | "concluidas">("minhas");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);

  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    let q = (supabase as any)
      .from("lead_tarefas")
      .select(
        "*, lead:leads(id,nome), contrato:contratos(id,numero), cartorio_registro:cartorio_registros(id,tipo,cartorio_nome), parceiro:parceiros_comerciais(id,nome_empresa,nome_contato)",
      )
      .eq("tenant_id", tenantId)
      .order("prazo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (filtro === "minhas")
      q = q.eq("status", "pendente").eq("responsavel_user_id", user?.id ?? "");
    else if (filtro === "todas") q = q.eq("status", "pendente");
    else q = q.eq("status", "concluida");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setTarefas((data ?? []) as Tarefa[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tenantId, filtro, user?.id]);

  async function carregarParceiros() {
    if (!tenantId) return;
    const { data } = await (supabase as any)
      .from("parceiros_comerciais")
      .select("id,nome_empresa,nome_contato")
      .eq("tenant_id", tenantId)
      .order("nome_empresa");
    setParceiros((data as Parceiro[]) ?? []);
  }

  useEffect(() => {
    carregarParceiros();
  }, [tenantId]);

  async function toggle(t: Tarefa) {
    const novo = t.status === "concluida" ? "pendente" : "concluida";
    await (supabase as any)
      .from("lead_tarefas")
      .update({
        status: novo,
        concluida_em: novo === "concluida" ? new Date().toISOString() : null,
      })
      .eq("id", t.id);
    load();
  }

  function abrirForm() {
    setForm(FORM_INICIAL);
    setShowForm(true);
  }

  // Mesmo lazy-seed usado em app.parceiros-comerciais.tsx — garante que
  // sempre existe pelo menos 1 etapa antes de criar um parceiro novo aqui.
  async function garantirEtapaPadrao(): Promise<string | null> {
    const { data } = await (supabase as any)
      .from("parceiro_etapas")
      .select("id")
      .eq("tenant_id", tenantId)
      .order("ordem")
      .limit(1)
      .maybeSingle();
    if (data) return data.id;
    const { data: nova } = await (supabase as any)
      .from("parceiro_etapas")
      .insert({ tenant_id: tenantId, nome: "Novo Contato", ordem: 0 })
      .select("id")
      .single();
    return nova?.id ?? null;
  }

  async function criarTarefa() {
    if (!tenantId || !user) return;
    if (!form.titulo.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setSalvando(true);

    let parceiroId: string | null = null;
    if (form.parceiroId === NOVO_PARCEIRO) {
      if (!form.novoParceiroNome.trim() && !form.novoParceiroContato.trim()) {
        toast.error("Informe a empresa ou o nome do contato do novo parceiro.");
        setSalvando(false);
        return;
      }
      const etapaId = await garantirEtapaPadrao();
      const { data: novoParceiro, error: perr } = await (supabase as any)
        .from("parceiros_comerciais")
        .insert({
          tenant_id: tenantId,
          nome_empresa: form.novoParceiroNome.trim() || null,
          nome_contato: form.novoParceiroContato.trim() || null,
          cargo: form.novoParceiroCargo.trim() || null,
          telefone: form.novoParceiroTelefone.trim() || null,
          email: form.novoParceiroEmail.trim() || null,
          canal_contato: form.novoParceiroCanal || null,
          etapa_id: etapaId,
        })
        .select("id")
        .single();
      if (perr) {
        toast.error("Erro ao criar parceiro: " + perr.message);
        setSalvando(false);
        return;
      }
      parceiroId = novoParceiro.id;
    } else if (form.parceiroId !== SEM_PARCEIRO) {
      parceiroId = form.parceiroId;
    }

    const { error } = await (supabase as any).from("lead_tarefas").insert({
      tenant_id: tenantId,
      parceiro_id: parceiroId,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      tipo: form.tipo,
      prioridade: form.prioridade,
      prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
      responsavel_user_id: user.id,
      created_by: user.id,
    });
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada");
    setShowForm(false);
    load();
    if (form.parceiroId === NOVO_PARCEIRO) carregarParceiros();
  }

  const pendentes = tarefas.filter((t) => t.status === "pendente");
  const atrasadas = pendentes.filter((t) => isTarefaAtrasada(t));
  const hoje = pendentes.filter((t) => isTarefaHoje(t));

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lembretes e follow-ups de leads, contratos, cartórios e parceiros comerciais.
          </p>
        </div>
        <Button onClick={abrirForm}>
          <Plus className="mr-2 h-4 w-4" /> Nova Tarefa
        </Button>
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
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? "default" : "outline"}
            onClick={() => setFiltro(f)}
          >
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
            const atrasada = isTarefaAtrasada(t);
            return (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm"
              >
                <button onClick={() => toggle(t)} className="mt-0.5">
                  {t.status === "concluida" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                  )}
                </button>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={t.status === "concluida" ? "line-through" : "font-medium"}>
                      {t.titulo}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.tipo}
                    </Badge>
                    {t.prioridade === "alta" && (
                      <Badge className="bg-rose-600 text-[10px]">alta</Badge>
                    )}
                    {atrasada && (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-600 text-[10px]"
                      >
                        <AlertCircle className="mr-1 h-3 w-3" /> atrasada
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {t.prazo && <span>{new Date(t.prazo).toLocaleString("pt-BR")}</span>}
                    {t.lead && t.lead_id && (
                      <Link
                        to="/app/leads/$id"
                        params={{ id: t.lead_id }}
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        Lead: {t.lead.nome} <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                    {t.contrato && t.contrato_id && (
                      <Link
                        to="/app/contratos/$id"
                        params={{ id: t.contrato_id }}
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        Contrato {t.contrato.numero ? `#${t.contrato.numero}` : ""}{" "}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                    {t.cartorio_registro && !t.contrato && (
                      <Link
                        to="/app/cartorios"
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        Cartório
                        {t.cartorio_registro.cartorio_nome
                          ? `: ${t.cartorio_registro.cartorio_nome}`
                          : ""}{" "}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                    {t.parceiro && (
                      <Link
                        to="/app/parceiros-comerciais"
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        <Briefcase className="h-3 w-3" /> {nomeParceiro(t.parceiro)}{" "}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tipo
                </Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
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
                  Prioridade
                </Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Parceiro comercial (opcional)
              </Label>
              <Select
                value={form.parceiroId}
                onValueChange={(v) => setForm((f) => ({ ...f, parceiroId: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_PARCEIRO}>Nenhum</SelectItem>
                  {parceiros.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {nomeParceiro(p)}
                    </SelectItem>
                  ))}
                  <SelectItem value={NOVO_PARCEIRO}>+ Criar novo parceiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.parceiroId === NOVO_PARCEIRO && (
              <div className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Empresa
                  </Label>
                  <Input
                    value={form.novoParceiroNome}
                    onChange={(e) => setForm((f) => ({ ...f, novoParceiroNome: e.target.value }))}
                    placeholder="Ex.: Construtora Martino"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nome do contato
                  </Label>
                  <Input
                    value={form.novoParceiroContato}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, novoParceiroContato: e.target.value }))
                    }
                    placeholder="Ex.: Ana Paula"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Cargo
                  </Label>
                  <Input
                    value={form.novoParceiroCargo}
                    onChange={(e) => setForm((f) => ({ ...f, novoParceiroCargo: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Canal usado
                  </Label>
                  <Select
                    value={form.novoParceiroCanal || undefined}
                    onValueChange={(v) => setForm((f) => ({ ...f, novoParceiroCanal: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="formulario">Formulário</SelectItem>
                      <SelectItem value="presencial">Presencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Telefone
                  </Label>
                  <Input
                    value={form.novoParceiroTelefone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, novoParceiroTelefone: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    E-mail
                  </Label>
                  <Input
                    type="email"
                    value={form.novoParceiroEmail}
                    onChange={(e) => setForm((f) => ({ ...f, novoParceiroEmail: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Título *
              </Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex.: Ligar pra Construtora Martino"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Descrição / observações
              </Label>
              <Textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="max-w-xs">
              <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prazo / retorno
              </Label>
              <Input
                type="datetime-local"
                value={form.prazo}
                onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={criarTarefa} disabled={salvando}>
              {salvando ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
