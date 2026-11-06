import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { getUnreadTotal } from "@/lib/chat.functions";
import { useChatRealtime } from "@/hooks/useChatRealtime";

/**
 * Atalho do chat na barra superior do /app. Principal canal de contato do
 * cliente com o corretor: fica sempre visível, com rótulo, e ganha destaque
 * e alerta pulsante quando há mensagens não lidas.
 */
export function ChatBadge({ to = "/app/chat" }: { to?: string }) {
  const fn = useServerFn(getUnreadTotal);
  const { data } = useQuery({
    queryKey: ["chat", "unread"],
    queryFn: () => fn({ data: undefined as any }),
    refetchInterval: 60_000,
  });
  useChatRealtime();
  const total = (data?.corretor ?? 0) + (data?.interessado ?? 0);
  const contagem = total > 99 ? "99+" : String(total);
  return (
    <Link
      to={to}
      aria-label={total > 0 ? `Chat, ${contagem} mensagens novas` : "Chat"}
      className={`relative inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors ${
        total > 0
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90"
          : "border border-border bg-card text-foreground hover:bg-muted"
      }`}
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Chat</span>
      {total > 0 && (
        <>
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-primary">
            {contagem}
          </span>
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-card bg-primary" />
          </span>
        </>
      )}
    </Link>
  );
}
