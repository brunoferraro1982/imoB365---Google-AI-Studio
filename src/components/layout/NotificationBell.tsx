import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type Notif = {
  id: string; titulo: string; mensagem: string | null;
  link: string | null; lida_em: string | null; created_at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,titulo,mensagem,link,lida_em,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`notif-${user.id}-${Math.random().toString(36).substring(7)}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  async function markAllRead() {
    if (!user) return;
    await supabase.from("notifications").update({ lida_em: new Date().toISOString() })
      .is("lida_em", null).eq("user_id", user.id);
    load();
  }

  const unread = items.filter((n) => !n.lida_em).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-sidebar-foreground/80 hover:bg-sidebar-accent/60">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs font-normal text-muted-foreground hover:text-foreground">
              Marcar todas
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">Sem notificações</div>
        ) : items.map((n) => (
          <DropdownMenuItem key={n.id} asChild className="cursor-pointer">
            <Link
              to={(n.link as any) ?? "#"}
              onClick={async () => {
                if (!n.lida_em) {
                  await supabase.from("notifications").update({ lida_em: new Date().toISOString() }).eq("id", n.id);
                  load();
                }
              }}
              className={`flex flex-col items-start gap-0.5 py-2 ${!n.lida_em ? "bg-muted/40" : ""}`}
            >
              <div className="text-sm font-medium">{n.titulo}</div>
              {n.mensagem && <div className="line-clamp-2 text-xs text-muted-foreground">{n.mensagem}</div>}
              <div className="text-[10px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString("pt-BR")}
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}