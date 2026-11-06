import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LogoIcon } from "@/components/brand/Logo";

export type RailSection = {
  id: string;
  label: string;
  /** Rótulo curto (cabe no trilho de ~84px). Cai no `label` se ausente. */
  curto?: string;
  icon: LucideIcon;
  items: { to: string }[];
  /** Destaque visual permanente (ex.: chat). */
  destaque?: boolean;
  /** Indicador extra no canto do item (ex.: contador de não lidas). */
  badge?: ReactNode;
};

/**
 * Trilho vertical de módulos à esquerda (desktop, >= lg). Ícone + nome curto
 * sempre visíveis, sem depender de hover. Se faltar altura, rola na vertical.
 */
export function AppRail({
  sections,
  activeId,
  ariaLabel,
  footer,
}: {
  sections: RailSection[];
  activeId: string | undefined;
  ariaLabel: string;
  footer?: ReactNode;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-21 shrink-0 flex-col border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground lg:flex print:hidden">
      <Link to="/" className="flex justify-center pt-4 pb-3" aria-label="Início do portal">
        <LogoIcon className="h-9 w-9" />
      </Link>
      <nav
        aria-label={ariaLabel}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2"
      >
        {sections.map((s) => {
          const ativo = s.id === activeId;
          return (
            <Link
              key={s.id}
              to={s.items[0].to}
              title={s.label}
              aria-current={ativo ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center text-[10.5px] leading-tight transition-colors ${
                s.destaque
                  ? ativo
                    ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/30"
                    : "bg-primary/15 font-bold text-primary ring-1 ring-primary/40 hover:bg-primary/25"
                  : ativo
                    ? "bg-primary/20 font-medium text-primary shadow-sm"
                    : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <s.icon className={`h-5 w-5 shrink-0 ${ativo ? "stroke-[2.25px]" : "opacity-85"}`} />
              <span className="line-clamp-1 w-full">{s.curto ?? s.label}</span>
              {s.badge && <span className="absolute right-1 top-1">{s.badge}</span>}
            </Link>
          );
        })}
      </nav>
      {footer && (
        <div className="flex flex-col items-center gap-2 border-t border-sidebar-border/70 px-2 py-3">
          {footer}
        </div>
      )}
    </aside>
  );
}
