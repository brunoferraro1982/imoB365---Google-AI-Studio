import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserMenu } from "@/components/layout/UserMenu";

/**
 * Barra utilitária fina do /app (altura fixa, poucos itens). Em telas menores
 * que lg mostra o logo, já que o trilho some. A navegação fica no trilho,
 * no submenu e na barra inferior — nunca numa barra horizontal que estoura.
 */
export function AppTopBar({
  trilha,
  actions,
  email,
  isSuperAdmin,
  onSignOut,
}: {
  trilha: string[];
  actions?: ReactNode;
  email: string;
  isSuperAdmin: boolean;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border/80 bg-card/95 px-4 backdrop-blur-md print:hidden">
      <Link to="/" className="shrink-0 lg:hidden" aria-label="Início do portal">
        <Logo className="h-6 w-auto" />
      </Link>
      <nav
        aria-label="Localização"
        className="hidden min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-muted-foreground lg:flex"
      >
        {trilha.map((parte, i) => (
          <span key={`${parte}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/50">›</span>}
            <span
              className={`truncate ${i === trilha.length - 1 ? "font-semibold text-foreground" : ""}`}
            >
              {parte}
            </span>
          </span>
        ))}
      </nav>
      {/* Os botões de ícone usam tokens da sidebar (escura em ambos os temas); aqui a barra é clara. */}
      <div className="ml-auto flex items-center gap-2 text-foreground [&_button]:text-muted-foreground [&_button:hover]:bg-muted [&_button:hover]:text-foreground">
        {actions}
        <NotificationBell />
        <UserMenu email={email} isSuperAdmin={isSuperAdmin} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
