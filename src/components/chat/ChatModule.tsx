import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Send, Search, MessageCircle, ArrowLeft } from "lucide-react";
import {
  getConversation,
  getMessages,
  listConversations,
  listQuickReplies,
  markRead,
  sendMessage,
} from "@/lib/chat.functions";
import { useChatRealtime } from "@/hooks/useChatRealtime";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/format";

type Role = "corretor" | "interessado";

function fotoUrl(path: string | null) {
  if (!path) return null;
  return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 2 * day) return "Ontem";
  if (diff < 7 * day)
    return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ChatModule({
  role,
  selectedId,
  basePath,
}: {
  role: Role;
  selectedId?: string;
  basePath: string; // "/app/chat" ou "/conta/chat"
}) {
  const [filter, setFilter] = useState<"todas" | "vendendo" | "comprando">(
    role === "corretor" ? "vendendo" : "comprando",
  );
  const [search, setSearch] = useState("");

  const list = useServerFn(listConversations);
  const convsQuery = useQuery({
    queryKey: ["chat", "conversations", filter, search],
    queryFn: () => list({ data: { filter, search: search || undefined } }),
  });

  useChatRealtime(selectedId);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_320px] rounded-lg border border-border bg-card overflow-hidden ${
      role === "interessado" ? "h-[500px] md:h-[calc(100vh-14rem)] md:min-h-[480px] md:max-h-[640px]" : "h-[calc(100vh-3.5rem)]"
    }`}>
      {/* Coluna 1: lista */}
      <aside
        className={`flex flex-col border-r border-border bg-card h-full min-h-0 ${
          selectedId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">Chat</h2>
          <div className="relative mt-3">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por imóvel ou contato"
              className="pl-8"
            />
          </div>
          {role === "corretor" && (
            <div className="mt-3 flex gap-1.5 text-xs">
              {(["todas", "vendendo", "comprando"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f === "todas" ? "Todas" : f === "vendendo" ? "Vendendo" : "Comprando"}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {convsQuery.isLoading && (
            <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
          )}
          {(convsQuery.data?.items ?? []).length === 0 && !convsQuery.isLoading && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma conversa ainda.
            </p>
          )}
          {(convsQuery.data?.items ?? []).map((c: any) => {
            const active = c.id === selectedId;
            const img = fotoUrl(c.imovel?.fotoPath ?? null);
            return (
              <Link
                key={c.id}
                to={`${basePath}/$id`}
                params={{ id: c.id }}
                className={`flex gap-3 border-b border-border/60 p-3 transition-colors hover:bg-muted/60 ${
                  active ? "bg-muted" : ""
                }`}
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  {img ? (
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {c.assunto}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(c.lastMessageAt)}
                    </span>
                  </div>
                  <p className="truncate text-sm font-medium">
                    {c.counterpartName}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {c.lastMessagePreview ?? "—"}
                    </p>
                    {c.unread > 0 && (
                      <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Colunas 2 e 3: conversa */}
      {selectedId ? (
        <ConversationView
          id={selectedId}
          role={role}
          basePath={basePath}
        />
      ) : (
        <div className="hidden items-center justify-center text-sm text-muted-foreground md:flex md:col-span-1 xl:col-span-2">
          Selecione uma conversa
        </div>
      )}
    </div>
  );
}

function ConversationView({
  id,
  role,
  basePath,
}: {
  id: string;
  role: Role;
  basePath: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getConv = useServerFn(getConversation);
  const getMsgs = useServerFn(getMessages);
  const send = useServerFn(sendMessage);
  const markReadFn = useServerFn(markRead);

  const convQuery = useQuery({
    queryKey: ["chat", "conversation", id],
    queryFn: () => getConv({ data: { id } }),
  });
  const msgsQuery = useQuery({
    queryKey: ["chat", "messages", id],
    queryFn: () => getMsgs({ data: { conversationId: id } }),
  });

  const tenantId = convQuery.data?.tenantId;
  const quickFn = useServerFn(listQuickReplies);
  const quickQuery = useQuery({
    queryKey: ["chat", "quick", tenantId],
    queryFn: () => quickFn({ data: { tenantId: tenantId! } }),
    enabled: !!tenantId && role === "corretor",
  });

  // Marca como lida ao abrir
  useEffect(() => {
    if (convQuery.data) {
      markReadFn({ data: { conversationId: id } })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
          qc.invalidateQueries({ queryKey: ["chat", "unread"] });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, convQuery.data?.id]);

  const [text, setText] = useState("");

  // Limpa o texto ao trocar de conversa para evitar vazamento de conteúdo digitado
  useEffect(() => {
    setText("");
  }, [id]);

  const scroller = useRef<HTMLDivElement>(null);

  // Scroll instantâneo ao carregar a conversa pela primeira vez ou mudar de ID
  useEffect(() => {
    if (scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [id, msgsQuery.isLoading]);

  // Scroll suave quando novas mensagens chegam
  useEffect(() => {
    if (scroller.current) {
      scroller.current.scrollTo({
        top: scroller.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [msgsQuery.data?.items?.length]);

  const sendMut = useMutation({
    mutationFn: (payload: { content: string; kind: "text" | "quick_reply" }) =>
      send({ data: { conversationId: id, ...payload } }),
    onSuccess: () => {
      setText("");
      msgsQuery.refetch();
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
      qc.invalidateQueries({ queryKey: ["chat", "unread"] });
    },
  });

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content) return;
    sendMut.mutate({ content, kind: "text" });
  }

  if (convQuery.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!convQuery.data) {
    return <div className="p-6 text-sm text-muted-foreground">Conversa indisponível.</div>;
  }

  const conv = convQuery.data;
  const imgUrl = fotoUrl(conv.imovel?.fotoPath ?? null);

  return (
    <>
      <section className="flex min-w-0 flex-col bg-background h-full min-h-0">
        {/* Header da thread */}
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 text-card-foreground">
          <button
            className="md:hidden"
            onClick={() => navigate({ to: basePath })}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{conv.counterpart.nome}</p>
            <p className="truncate text-xs text-muted-foreground">{conv.assunto}</p>
          </div>
        </header>

        {/* Banner de segurança */}
        <div className="flex items-center gap-2 border-b border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          Nunca compartilhe senhas, códigos ou dados bancários por este chat.
        </div>

        {/* Card do Imóvel para Contexto Rápido (Igual ao OLX) */}
        {conv.imovel && (
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-sm sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted border border-border">
                {imgUrl ? (
                  <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-xs text-foreground truncate max-w-[180px] sm:max-w-xs">{conv.imovel.titulo}</h4>
                <p className="text-xs font-bold text-primary mt-0.5">{formatBRL(conv.imovel.preco)}</p>
              </div>
            </div>
            {conv.imovel.disponivel && (
              <Link
                to="/imovel/$slug"
                params={{ slug: conv.imovel.slug }}
                className="shrink-0 text-xs font-semibold text-primary hover:text-primary/90 border border-primary/20 rounded-md px-3 py-1 bg-background hover:bg-muted/50 transition-colors shadow-sm"
              >
                Ver anúncio
              </Link>
            )}
          </div>
        )}

        {/* Mensagens */}
        <div ref={scroller} className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
          {msgsQuery.isLoading && (
            <p className="py-4 text-center text-sm text-muted-foreground">Carregando mensagens...</p>
          )}
          {(msgsQuery.data?.items ?? []).map((m: any) => {
            const mine =
              (role === "interessado" && m.sender_role === "interessado") ||
              (role === "corretor" && m.sender_role === "corretor");
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    mine
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-muted text-foreground rounded-tl-none border border-border/40"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px]">
                    <span className={mine ? "text-primary-foreground/75" : "text-muted-foreground"}>
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {mine && (
                      <span className={m.read_at ? "text-emerald-300 font-bold ml-0.5" : "text-primary-foreground/50 ml-0.5"}>
                        {m.read_at ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {(msgsQuery.data?.items ?? []).length === 0 && !msgsQuery.isLoading && (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <MessageCircle className="h-8 w-8 text-muted-foreground/50 animate-bounce" />
              <p>Comece a conversa enviando uma mensagem.</p>
            </div>
          )}
        </div>

        {/* Respostas rápidas (interessado/comprador - Igual ao OLX) */}
        {role === "interessado" && (
          <div className="flex gap-2 overflow-x-auto border-t border-border bg-card/60 px-4 py-2 scrollbar-none [scrollbar-width:none]">
            {[
              "Olá, ainda está disponível?",
              "Gostaria de agendar uma visita.",
              "Aceita contraproposta?",
              "Quais as garantias de locação?",
            ].map((textMsg) => (
              <button
                key={textMsg}
                type="button"
                onClick={() => sendMut.mutate({ content: textMsg, kind: "text" })}
                disabled={sendMut.isPending}
                className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50 active:scale-95 duration-70"
              >
                {textMsg}
              </button>
            ))}
          </div>
        )}

        {/* Respostas rápidas (corretor/imobiliária) */}
        {role === "corretor" && quickQuery.data?.items && quickQuery.data.items.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border bg-card/60 px-4 py-2">
            {quickQuery.data.items.map((q: any) => (
              <button
                key={q.id}
                type="button"
                onClick={() =>
                  sendMut.mutate({ content: q.content, kind: "quick_reply" })
                }
                className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted active:scale-95 duration-70"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={submit}
          className="flex items-end gap-2 border-t border-border bg-card p-3"
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Escreva uma mensagem… (Enter para enviar, Shift+Enter quebra linha)"
            rows={1}
            className="max-h-32 min-h-[40px] resize-none"
            maxLength={4000}
          />
          <Button type="submit" disabled={sendMut.isPending || !text.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>

      {/* Coluna 3: imóvel */}
      <aside className="hidden flex-col border-l border-border bg-card xl:flex h-full min-h-0">
        {conv.imovel ? (
          <>
            {imgUrl && (
              <img src={imgUrl} alt="" className="h-48 w-full object-cover" />
            )}
            <div className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {conv.imovel.finalidade === "venda" ? "Venda" : "Locação"}
              </p>
              <h3 className="mt-1 text-base font-semibold">{conv.imovel.titulo}</h3>
              <p className="mt-2 text-2xl font-bold text-primary">
                {formatBRL(conv.imovel.preco)}
              </p>
              {conv.imovel.disponivel ? (
                <Link
                  to="/imovel/$slug"
                  params={{ slug: conv.imovel.slug }}
                  className="mt-4 inline-block text-sm text-primary hover:underline"
                >
                  Ver anúncio →
                </Link>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  Anúncio indisponível.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Imóvel indisponível.</p>
        )}
      </aside>
    </>
  );
}