/**
 * Sub-navegação do módulo ativo no mobile (/app) — dropdown com as sub-páginas
 * do módulo. No desktop, esse conteúdo (`activeModule.items`) vive no aside
 * lateral esquerdo do AppShell (escondido no mobile). Sem isso, a bottom-nav só
 * leva ao 1º item de cada módulo e as demais sub-páginas ficam inacessíveis.
 *
 * É um dropdown (não uma barra rolável) de propósito: com muitos itens, a barra
 * horizontal estourava a tela; o dropdown é largura-total, mostra a página atual
 * e lista todas as sub-páginas verticalmente (com scroll interno se preciso).
 */
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { isItemActive, type Item as SubItem } from "@/components/layout/navConfig";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function ModuleSubNav({ items, current }: { items: SubItem[]; current: string }) {
  // Módulo de item único não precisa de sub-nav.
  if (items.length <= 1) return null;

  const atual = items.find((it) => isItemActive(it, items, current)) ?? items[0];
  const IconAtual = atual.icon;

  return (
    <div className="sticky top-12 z-20 border-b border-border/70 bg-card/95 px-3 py-2 backdrop-blur-md lg:hidden print:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/30 px-3 py-2 text-sm font-medium text-sidebar-foreground">
            <IconAtual className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 truncate text-left">{atual.label}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-[70vh] w-[calc(100vw-1.5rem)] overflow-y-auto"
        >
          {items.map((item) => {
            const active = isItemActive(item, items, current);
            return (
              <DropdownMenuItem key={item.to} asChild>
                <Link
                  to={item.to}
                  className={active ? "font-semibold text-primary" : "text-foreground"}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
