import { Link } from "@tanstack/react-router";
import { Building2, Newspaper, Handshake, MessageCircle, type LucideIcon } from "lucide-react";

/**
 * InstitutionalNav — menu institucional do topbar (barra preta do SiteHeader).
 * Design intermediário: maior que a v1, com hover/active em "pílula" (estilo
 * próximo ao mega menu), porém sem dropdowns. Rotas já existentes.
 */
const ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/sobre", label: "Sobre", icon: Building2 },
  { to: "/blog", label: "Blog", icon: Newspaper },
  { to: "/consultoria", label: "Consultoria", icon: Handshake },
  { to: "/contato", label: "Contato", icon: MessageCircle },
];

export function InstitutionalNav() {
  return (
    <nav
      aria-label="Institucional"
      className="flex flex-wrap items-center justify-center sm:justify-end gap-0.5 sm:gap-1 w-full sm:w-auto"
    >
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          activeProps={{ className: "bg-white/10 text-white" }}
        >
          <Icon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
