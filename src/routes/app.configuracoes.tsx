import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Rocket } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes")({
  component: ConfiguracoesLayout,
});

const TABS = [
  { to: "/app/configuracoes/imobiliaria", label: "Imobiliária" },
  { to: "/app/configuracoes/branding", label: "Marca & Domínio" },
  { to: "/app/configuracoes/equipe", label: "Equipe" },
  { to: "/app/configuracoes/funis", label: "Funis" },
  { to: "/app/configuracoes/scoring", label: "Lead scoring" },
  { to: "/app/configuracoes/cadencias", label: "Cadências" },
  { to: "/app/configuracoes/modulos", label: "Módulos" },
  { to: "/app/contratacao", label: "Plano & Contratação" },
  { to: "/app/configuracoes/campos", label: "Campos personalizados" },
  { to: "/app/configuracoes/webhooks", label: "Webhooks" },
  { to: "/app/configuracoes/api", label: "API" },
  { to: "/app/configuracoes/notificacoes", label: "Notificações" },
  { to: "/app/configuracoes/importar", label: "Importar" },
  { to: "/app/configuracoes/dominios", label: "Domínios" },
  { to: "/app/configuracoes/golive", label: "Go-live" },
  { to: "/app/configuracoes/seguranca", label: "Segurança" },
  { to: "/app/configuracoes/privacidade", label: "Privacidade (LGPD)" },
];

function ConfiguracoesLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">Configurações</h1>
        <p className="mt-1.5 text-sm text-muted-foreground font-medium">Ajustes da sua imobiliária, equipe e módulos integrados.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar Column */}
        <nav className="lg:col-span-3 space-y-1 bg-white dark:bg-card border border-border/70 rounded-2xl p-4 shadow-sm sticky top-24">
          <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest block px-3.5 mb-2.5">Menu de Configurações</span>
          <div className="space-y-1 max-h-[80vh] overflow-y-auto pr-1 scrollbar-thin">
            {TABS.map((t) => {
              const active = path === t.to || (t.to !== "/app/configuracoes" && path.startsWith(t.to));
              const isGoLive = t.to === "/app/configuracoes/golive";
              
              if (isGoLive) {
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-300 outline-none border ${
                      active
                        ? "bg-gradient-to-r from-primary/15 to-orange-500/5 text-primary border-primary shadow-2xs pl-3"
                        : "bg-amber-500/[0.04] text-amber-700 hover:bg-amber-500/10 dark:bg-amber-400/[0.02] dark:text-amber-400 border-amber-500/15 dark:border-amber-500/10 hover:border-amber-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Rocket className={`h-3.5 w-3.5 stroke-[2.25px] ${active ? "text-primary animate-bounce" : "text-amber-500 animate-pulse"}`} />
                      <span>{t.label}</span>
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${active ? "bg-primary text-white" : "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300"}`}>
                      Lançar
                    </span>
                  </Link>
                );
              }

              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`flex items-center w-full px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 outline-none ${
                    active
                      ? "bg-primary/10 text-primary border-l-2 border-primary rounded-l-xs pl-3"
                      : "text-muted-foreground hover:bg-neutral-50/80 hover:text-foreground dark:hover:bg-neutral-900/50"
                  }`}
                >
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content Column Area */}
        <main className="lg:col-span-9 bg-white dark:bg-card border border-border/70 rounded-2xl p-6.5 shadow-sm min-h-[500px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}