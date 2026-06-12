import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Heart, Bookmark, Calendar, MessageCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/conta")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as any });
    }
  },
  component: ContaLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/conta", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/conta/favoritos", label: "Favoritos", icon: Heart },
  { to: "/conta/buscas", label: "Buscas salvas", icon: Bookmark },
  { to: "/conta/visitas", label: "Visitas", icon: Calendar },
  { to: "/conta/chat", label: "Conversas", icon: MessageCircle },
  { to: "/conta/perfil", label: "Perfil", icon: User },
];

function ContaLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as any}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <section className="min-w-0">
          <Outlet />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
