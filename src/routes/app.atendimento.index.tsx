import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Headset, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { listChamadoAssignees } from "@/lib/atendimento.functions";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  PRIORIDADE_LABEL,
  CATEGORIA_LABEL,
  CANAL_LABEL,
} from "@/lib/chamadosLabels";

export const Route = createFileRoute("/app/atendimento/")({
  beforeLoad: moduleGuard("atendimento"),
  component: AppAtendimentoPage,
});

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
  const { user, tenantId, roles } = useAuth();
  const podeGerenciar = roles.includes("admin") || roles.includes("atendente");
  const fetchAssignees = useServerFn(listChamadoAssignees);

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
      if (!notaInterna && selecionado.status === "novo") patch.status = "em_atendimento";
      if (Object.keys(patch).length > 0) {
        await supabase
          .from("chamados")
          .update(patch as never)
          .eq("id", selecionado.id)
          .select("id");
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

  const chamadosFiltrados = useMemo(() => {
    if (filtroStatus === "todos") return chamados;
    return chamados.filter((c) => c.status === filtroStatus);
  }, [chamados, filtroStatus]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Headset className="h-6 w-6" />
          Central de Atendimento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chamados de clientes sobre imóveis, atendimento e dúvidas comerciais.
        </p>
      </div>

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
