import { Link } from "@tanstack/react-router";
import { Info, Newspaper, Handshake, MessagesSquare, type LucideIcon } from "lucide-react";
import { IconeVidroClaro } from "@/components/site/MegaNav";

/**
 * InstitutionalNav — menu institucional do top bar do portal (faixa de vidro
 * claro do header "brand"). Hover/ativo em pílula de vidro; ícones em
 * mini-tiles de vidro com ícone laranja (mesmo padrão do mega menu).
 */
const ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/sobre", label: "Sobre", icon: Info },
  { to: "/blog", label: "Blog", icon: Newspaper },
  { to: "/consultoria", label: "Consultoria", icon: Handshake },
  { to: "/contato", label: "Contato", icon: MessagesSquare },
];

export function InstitutionalNav() {
  return (
    <nav
      aria-label="Institucional"
      className="flex w-full flex-wrap items-center justify-center gap-0.5 sm:w-auto sm:justify-end sm:gap-1"
    >
      {ITEMS.map(({ to, label, icon }) => (
        <Link
          key={to}
          to={to}
          className="group flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-[12.5px] font-semibold text-slate-700 transition-colors hover:border-white hover:bg-white/80 hover:text-slate-900 hover:shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ed7d31]/60"
          activeProps={{ className: "border-white bg-white/80 text-slate-900 shadow-sm" }}
        >
          <IconeVidroClaro icon={icon} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
