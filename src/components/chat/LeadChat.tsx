import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessagesSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mensagem = {
  id: string;
  conteudo: string;
  autor_user_id: string | null;
  autor_nome: string | null;
  autor_tipo: "corretor" | "sistema" | "lead";
  created_at: string;
};

export function LeadChat({ leadId, tenantId }: { leadId: string; tenantId: string }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("lead_mensagens")
        .select("id,conteudo,autor_user_id,autor_nome,autor_tipo,created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      if (!alive) return;
      if (error) toast.error(error.message);
      setMsgs((data as Mensagem[]) ?? []);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`lead-chat-${leadId}-${Math.random().toString(36).substring(7)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_mensagens", filter: `lead_id=eq.${leadId}` },
        (payload) => {
          setMsgs((prev) =>
            prev.some((m) => m.id === (payload.new as Mensagem).id) ? prev : [...prev, payload.new as Mensagem],
          );
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    const conteudo = text.trim();
    if (!conteudo || !user) return;
    setSending(true);
    const { error } = await (supabase as any).from("lead_mensagens").insert({
      tenant_id: tenantId,
      lead_id: leadId,
      autor_user_id: user.id,
      autor_nome: user.email ?? null,
      autor_tipo: "corretor",
      conteudo,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
  }

  return (
    <div className="flex h-[460px] flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold">
        <MessagesSquare className="h-4 w-4" /> Conversa com o lead
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Escreva a primeira abaixo.
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.autor_user_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {!mine && m.autor_nome && (
                    <div className="mb-0.5 text-[10px] font-medium opacity-70">{m.autor_nome}</div>
                  )}
                  <div className="whitespace-pre-wrap">{m.conteudo}</div>
                  <div className="mt-1 text-[10px] opacity-60">
                    {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t p-2">
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            placeholder="Escreva uma mensagem..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button type="button" onClick={send} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">⌘/Ctrl + Enter para enviar</p>
      </div>
    </div>
  );
}