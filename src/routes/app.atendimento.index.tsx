import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Headset, Loader2, Plus, Send, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { moduleGuard } from "@/lib/routeGuard";
import { listChamadoAssignees, criarChamadoManual } from "@/lib/atendimento.functions";
import { enviarEmailChamado } from "@/lib/atendimentoEmail.functions";
import { enviarWhatsAppChamado } from "@/lib/atendimentoWhatsApp.functions";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  PRIORIDADE_LABEL,
  CATEGORIA_LABEL,
  CANAL_LABEL,
  CATEGORIA_CHAMADO,
} from "@/lib/chamadosLabels";

export const Route = createFileRoute("/app/atendimento/")({
  beforeLoad: moduleGuard("atendimento"),
  component: AppAtendimentoPage,
});

const NOVO_CHAMADO_VAZIO = {
  solicitanteNome: "",
  solicitanteEmail: "",
  solicitanteTelefone: "",
  categoria: "outro",
  assunto: "",
  mensagemInicial: "",
};

type Chamado = {
  id: string;
  numero: string;
  solicitante_nome: string | null;
  solicitante_email: string | null;
  categoria: string;
  status: string;
  prioridade: string;
  assunto: string;
  atribuido_user_id: string | null;
  csat_nota: number | null;
  csat_comentario: string | null;
  created_at: string;
};

type Mensagem = {
  id: string;
  autor_tipo: string;
  canal: string;
  conteudo: string;
  interno: boolean;
  created_at: string;
};

type Assignee = { id: string; nome: string };
type QuickReply = { id: string; label: string; content: string };

const STATUS_FILTROS = ["novo", "em_atendimento", "aguardando_cliente", "resolvido", "fechado"];

function AppAtendimentoPage() {
  const { user, session, tenantId, roles } = useAuth();
  const podeGerenciar = roles.includes("admin") || roles.includes("atendente");
  const fetchAssignees = useServerFn(listChamadoAssignees);
  const fetchEnviarEmailChamado = useServerFn(enviarEmailChamado);
  const fetchEnviarWhatsAppChamado = useServerFn(enviarWhatsAppChamado);
  const fetchCriarChamadoManual = useServerFn(criarChamadoManual);

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<Chamado | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [resposta, setResposta] = useState("");
  const [notaInterna, setNotaInterna] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoChamado, setNovoChamado] = useState(NOVO_CHAMADO_VAZIO);
  const [criando, setCriando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [erroSugestao, setErroSugestao] = useState<string | null>(null);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chamados")
        .select(
          "id,numero,solicitante_nome,solicitante_email,categoria,status,prioridade,assunto,atribuido_user_id,csat_nota,csat_comentario,created_at",
        )
        .eq("responsavel_tipo", "tenant")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setChamados((data ?? []) as Chamado[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar chamados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (tenantId) {
      supabase
        .from("chat_quick_replies")
        .select("id,label,content")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("ordem")
        .then(({ data }) => setQuickReplies((data ?? []) as QuickReply[]));
      if (podeGerenciar) {
        fetchAssignees({ data: { tenantId } })
          .then((data) => setAssignees(data))
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function abrirChamado(chamado: Chamado) {
    setSelecionado(chamado);
    const { data, error } = await supabase
      .from("chamado_mensagens")
      .select("id,autor_tipo,canal,conteudo,interno,created_at")
      .eq("chamado_id", chamado.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar mensagens do chamado");
      return;
    }
    setMensagens((data ?? []) as Mensagem[]);
  }

  async function enviarResposta() {
    if (!selecionado || !resposta.trim()) return;
    setEnviando(true);
    try {
      const { error } = await supabase.from("chamado_mensagens").insert({
        chamado_id: selecionado.id,
        autor_tipo: "agente",
        autor_user_id: user?.id,
        canal: "web_chat",
        conteudo: resposta.trim(),
        interno: notaInterna,
      });
      if (error) throw error;

      const patch: Record<string, unknown> = {};
      if (!notaInterna && selecionado.status === "novo") {
        patch.status = "em_atendimento";
        // Marco de SLA: só a primeira resposta real (não-interna) conta
        // pra "primeira_resposta_em" — usado pela detecção de estouro.
        patch.primeira_resposta_em = new Date().toISOString();
      }
      if (Object.keys(patch).length > 0) {
        await supabase
          .from("chamados")
          .update(patch as never)
          .eq("id", selecionado.id)
          .select("id");
      }

      // Notifica o solicitante por e-mail/WhatsApp quando o tenant tem o
      // canal correspondente configurado — best effort, nunca bloqueia o
      // fluxo de resposta se não estiver configurado ou falhar.
      if (!notaInterna) {
        fetchEnviarEmailChamado({ data: { chamadoId: selecionado.id } }).catch(() => {});
        fetchEnviarWhatsAppChamado({ data: { chamadoId: selecionado.id } }).catch(() => {});
      }

      setResposta("");
      setNotaInterna(false);
      await abrirChamado({ ...selecionado, ...patch } as Chamado);
      load();
      toast.success(notaInterna ? "Nota interna registrada." : "Resposta enviada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar resposta");
    } finally {
      setEnviando(false);
    }
  }

  // A RLS de UPDATE em `chamados` filtra silenciosamente linhas fora de
  // permissão (ex.: broker tentando mexer num chamado não atribuído a ele)
  // — o client Supabase não lança erro nesse caso, só retorna 0 linhas. Sem
  // `.select()` + checagem de `data.length`, a UI mostraria sucesso mesmo
  // quando nada foi realmente salvo (achado real testando com uma conta
  // broker). Todo update disparado por interação direta do usuário nesta
  // tela precisa dessa checagem.
  async function alterarStatus(status: string) {
    if (!selecionado) return;
    try {
      const patch: Record<string, unknown> = { status };
      if (status === "resolvido") patch.resolvido_em = new Date().toISOString();
      if (status === "fechado") patch.fechado_em = new Date().toISOString();
      const { data, error } = await supabase
        .from("chamados")
        .update(patch as never)
        .eq("id", selecionado.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Sem permissão pra alterar este chamado.");
      setSelecionado({ ...selecionado, status });
      load();
      toast.success("Status atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status");
    }
  }

  async function alterarPrioridade(prioridade: string) {
    if (!selecionado) return;
    try {
      const { data, error } = await supabase
        .from("chamados")
        .update({ prioridade } as never)
        .eq("id", selecionado.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Sem permissão pra alterar este chamado.");
      setSelecionado({ ...selecionado, prioridade });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar prioridade");
    }
  }

  async function atribuirA(userId: string) {
    if (!selecionado) return;
    try {
      const { data, error } = await supabase
        .from("chamados")
        .update({ atribuido_user_id: userId })
        .eq("id", selecionado.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Sem permissão pra atribuir este chamado.");
      setSelecionado({ ...selecionado, atribuido_user_id: userId });
      load();
      toast.success("Chamado atribuído.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atribuir chamado");
    }
  }

  async function criarNovoChamado() {
    if (!tenantId) return;
    if (!novoChamado.solicitanteNome.trim() || !novoChamado.assunto.trim()) {
      toast.error("Preencha nome e assunto.");
      return;
    }
    setCriando(true);
    try {
      await fetchCriarChamadoManual({
        data: {
          tenantId,
          solicitanteNome: novoChamado.solicitanteNome.trim(),
          solicitanteEmail: novoChamado.solicitanteEmail.trim() || undefined,
          solicitanteTelefone: novoChamado.solicitanteTelefone.trim() || undefined,
          categoria: novoChamado.categoria as
            | "problema_plataforma"
            | "duvida_comercial"
            | "reclamacao_anuncio"
            | "financeiro_cobranca"
            | "outro",
          assunto: novoChamado.assunto.trim(),
          mensagemInicial: novoChamado.mensagemInicial.trim() || novoChamado.assunto.trim(),
        },
      });
      toast.success("Chamado criado.");
      setNovoAberto(false);
      setNovoChamado(NOVO_CHAMADO_VAZIO);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar chamado");
    } finally {
      setCriando(false);
    }
  }

  async function sugerirResposta() {
    if (!selecionado || !session?.access_token) return;
    setSugerindo(true);
    setErroSugestao(null);
    setResposta("");
    try {
      const res = await fetch("/api/ai/sugestao-chamado", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ chamadoId: selecionado.id }),
      });
      if (!res.ok) {
        setErroSugestao((await res.text()) || "Erro ao gerar sugestão.");
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          setResposta((prev) => prev + decoder.decode(value, { stream: true }));
        }
      }
    } catch {
      setErroSugestao("Não foi possível gerar a sugestão agora.");
    } finally {
      setSugerindo(false);
    }
  }

  const chamadosFiltrados = useMemo(() => {
    if (filtroStatus === "todos") return chamados;
    return chamados.filter((c) => c.status === filtroStatus);
  }, [chamados, filtroStatus]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Headset className="h-6 w-6" />
            Central de Atendimento
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chamados de clientes sobre imóveis, atendimento e dúvidas comerciais.
          </p>
        </div>
        {podeGerenciar && (
          <Button size="sm" onClick={() => setNovoAberto(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo chamado
          </Button>
        )}
      </div>

      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">Nome *</Label>
              <Input
                value={novoChamado.solicitanteNome}
                onChange={(e) => setNovoChamado((f) => ({ ...f, solicitanteNome: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs uppercase text-muted-foreground">E-mail</Label>
                <Input
                  value={novoChamado.solicitanteEmail}
                  onChange={(e) =>
                    setNovoChamado((f) => ({ ...f, solicitanteEmail: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                  Telefone
                </Label>
                <Input
                  value={novoChamado.solicitanteTelefone}
                  onChange={(e) =>
                    setNovoChamado((f) => ({ ...f, solicitanteTelefone: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                Categoria
              </Label>
              <Select
                value={novoChamado.categoria}
                onValueChange={(v) => setNovoChamado((f) => ({ ...f, categoria: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIA_CHAMADO.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                Assunto *
              </Label>
              <Input
                value={novoChamado.assunto}
                onChange={(e) => setNovoChamado((f) => ({ ...f, assunto: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                Mensagem inicial
              </Label>
              <Textarea
                rows={3}
                value={novoChamado.mensagemInicial}
                onChange={(e) => setNovoChamado((f) => ({ ...f, mensagemInicial: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovoAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={criarNovoChamado} disabled={criando}>
              {criando ? "Criando..." : "Criar chamado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS_FILTROS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
            {chamadosFiltrados.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">Nenhum chamado.</div>
            )}
            {chamadosFiltrados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => abrirChamado(c)}
                className={`block w-full space-y-1 p-3 text-left text-sm hover:bg-muted/50 ${
                  selecionado?.id === c.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.numero}</span>
                  <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                </div>
                <div className="truncate text-muted-foreground">{c.assunto}</div>
                <div className="text-xs text-muted-foreground">
                  {c.solicitante_nome ?? c.solicitante_email ?? "—"} ·{" "}
                  {CATEGORIA_LABEL[c.categoria]}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          {!selecionado && (
            <div className="text-sm text-muted-foreground">
              Selecione um chamado na lista pra ver os detalhes.
            </div>
          )}
          {selecionado && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{selecionado.assunto}</div>
                  <div className="text-xs text-muted-foreground">
                    {selecionado.numero} · {CATEGORIA_LABEL[selecionado.categoria]} ·{" "}
                    {new Date(selecionado.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {podeGerenciar && (
                    <Select value={selecionado.atribuido_user_id ?? ""} onValueChange={atribuirA}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue placeholder="Atribuir a" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignees.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={selecionado.prioridade} onValueChange={alterarPrioridade}>
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORIDADE_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selecionado.status} onValueChange={alterarStatus}>
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTROS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selecionado.csat_nota != null && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-sm">
                  <Star className="h-4 w-4 text-amber-500" />
                  Satisfação: {selecionado.csat_nota}/5
                  {selecionado.csat_comentario && ` — "${selecionado.csat_comentario}"`}
                </div>
              )}

              <div className="space-y-3 rounded-md border border-border p-3">
                {mensagens.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</div>
                )}
                {mensagens.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-md p-2 text-sm ${
                      m.interno
                        ? "border border-dashed border-amber-500/50 bg-amber-500/10"
                        : m.autor_tipo === "agente"
                          ? "bg-primary/10"
                          : "bg-muted"
                    }`}
                  >
                    <div className="mb-1 text-xs text-muted-foreground">
                      {m.interno
                        ? "Nota interna"
                        : m.autor_tipo === "agente"
                          ? "Agente"
                          : "Cliente"}{" "}
                      · {new Date(m.created_at).toLocaleString("pt-BR")} · {CANAL_LABEL[m.canal]}
                    </div>
                    {m.conteudo}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {quickReplies.length > 0 && (
                  <Select onValueChange={(v) => setResposta(v)}>
                    <SelectTrigger className="h-8 w-56">
                      <SelectValue placeholder="Resposta rápida..." />
                    </SelectTrigger>
                    <SelectContent>
                      {quickReplies.map((q) => (
                        <SelectItem key={q.id} value={q.content}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {erroSugestao && <span className="text-destructive">{erroSugestao}</span>}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={sugerirResposta}
                    disabled={sugerindo}
                  >
                    {sugerindo ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                    )}
                    Sugerir resposta (IA)
                  </Button>
                </div>
                <Textarea
                  placeholder="Escrever resposta..."
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={notaInterna}
                      onChange={(e) => setNotaInterna(e.target.checked)}
                    />
                    Nota interna (não visível ao solicitante)
                  </label>
                  <Button onClick={enviarResposta} disabled={enviando || !resposta.trim()}>
                    <Send className="mr-1 h-4 w-4" />
                    {notaInterna ? "Registrar nota" : "Enviar resposta"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
