import { Link } from "@tanstack/react-router";
import { Info, Newspaper, Handshake, MessagesSquare, type LucideIcon } from "lucide-react";
import { IconeVidroTopo } from "@/components/site/MegaNav";

/**
 * InstitutionalNav — menu institucional do top bar PRETO do portal (header
 * "brand", padrão apple.com). Hover/ativo em pílula de vidro escuro; ícones em
 * mini-tiles de vidro com ícone laranja.
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
      className="flex min-w-0 items-center justify-start gap-0.5 overflow-x-auto sm:justify-end [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden"
    >
      {ITEMS.map(({ to, label, icon }) => (
        <Link
          key={to}
          to={to}
          className="group flex items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-[12.5px] font-semibold text-white/80 transition-colors hover:border-white/10 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ed7d31]/60"
          activeProps={{ className: "border-white/10 bg-white/10 text-white" }}
        >
          <IconeVidroTopo icon={icon} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
