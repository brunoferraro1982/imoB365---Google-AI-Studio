import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isItemActive, type Item } from "@/components/layout/navConfig";

export const SUBMENU_ABERTO_KEY = "imob365_submenu_aberto";

/**
 * Submenu do módulo ativo, em segunda coluna à esquerda (desktop, >= lg).
 * Pode ser recolhido (preferência salva) para dar espaço às telas densas.
 */
export function AppSubMenu({
  title,
  icon: Icon,
  items,
  current,
  aberto,
  onToggle,
  ariaLabel,
  renderBadge,
}: {
  title: string;
  icon: LucideIcon;
  items: Item[];
  current: string;
  aberto: boolean;
  onToggle: () => void;
  ariaLabel: string;
  /** Badge opcional por item (ex.: contagens do super-admin). */
  renderBadge?: (item: Item) => ReactNode;
}) {
  if (!aberto) {
    // Recolhido: mantém os ícones dos itens do módulo, com o atual destacado,
    // para o usuário continuar vendo onde está. O nome aparece no tooltip (title).
    return (
      <aside className="sticky top-0 hidden h-screen w-14 shrink-0 flex-col items-center border-r border-border/80 bg-card pt-3 lg:flex print:hidden">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expandir menu"
          aria-expanded={false}
          title={title}
          className="mb-2 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <nav aria-label={ariaLabel} className="flex flex-col items-center gap-1 overflow-y-auto">
          {items.map((item) => {
            const ativo = isItemActive(item, items, current);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                aria-current={ativo ? "page" : undefined}
                className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${
                  ativo
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground/75 hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className={`h-4 w-4 ${ativo ? "stroke-[2.25px]" : ""}`} />
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  }
  return (
    <aside className="sticky top-0 hidden h-screen w-62 shrink-0 flex-col border-r border-border/80 bg-card lg:flex print:hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-4">
        <div className="flex min-w-0 items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{title}</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Recolher menu"
          aria-expanded
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <nav aria-label={ariaLabel} className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item) => {
          const ativo = isItemActive(item, items, current);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={ativo ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                ativo
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <item.icon
                className={`h-4 w-4 shrink-0 ${ativo ? "stroke-[2.25px] text-primary" : "text-muted-foreground/70"}`}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {renderBadge?.(item)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
