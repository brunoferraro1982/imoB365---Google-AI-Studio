import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { getUnreadTotal } from "@/lib/chat.functions";
import { useChatRealtime } from "@/hooks/useChatRealtime";

export function ChatBadge({ to = "/app/chat" }: { to?: string }) {
  const fn = useServerFn(getUnreadTotal);
  const { data } = useQuery({
    queryKey: ["chat", "unread"],
    queryFn: () => fn({ data: undefined as any }),
    refetchInterval: 60_000,
  });
  useChatRealtime();
  const total = (data?.corretor ?? 0) + (data?.interessado ?? 0);
  return (
    <Link
      to={to}
      aria-label="Chat"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
    >
      <MessageCircle className="h-4 w-4" />
      {total > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {total > 99 ? "99+" : total}
        </span>
      )}
    </Link>
  );
}
