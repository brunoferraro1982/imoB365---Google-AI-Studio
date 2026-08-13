/**
 * Sub-navegação do módulo ativo no mobile (/app) — barra horizontal de sub-abas
 * logo abaixo do header, só no mobile (`md:hidden`). No desktop, o mesmo
 * conteúdo (`activeModule.items`) vive no aside lateral esquerdo do AppShell,
 * que fica escondido no mobile. Sem esta barra, a bottom-nav só leva ao 1º item
 * de cada módulo e as demais sub-páginas ficam inacessíveis no celular.
 *
 * Fica sticky logo abaixo do header (que é `sticky top-0` com `h-15`), rola na
 * horizontal e destaca a página atual — mesma lógica de "item ativo" do aside.
 */
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";

type SubItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };

// Reaproveita 1:1 a regra do aside do AppShell: trata o caso especial "/app" e
// desempata por prefixo (o item mais específico vence entre irmãos).
function itemAtivo(item: SubItem, items: SubItem[], current: string): boolean {
  if (item.to === "/app") return current === "/app";
  return (
    current === item.to ||
    (current.startsWith(item.to + "/") &&
      !items.some(
        (s) =>
          s.to !== item.to &&
          s.to !== "/app" &&
          current.startsWith(s.to) &&
          s.to.length > item.to.length,
      ))
  );
}

export function ModuleSubNav({ items, current }: { items: SubItem[]; current: string }) {
  // Módulo de item único não precisa de sub-nav.
  if (items.length <= 1) return null;

  return (
    // Container EXTERNO: largura travada no viewport (`w-full max-w-full min-w-0`)
    // + `overflow-x-auto` — é ele quem rola. O conteúdo interno (`w-max`) pode
    // ser mais largo que a tela sem estourar a página (o flex+overflow no MESMO
    // elemento, com filhos shrink-0, estourava pra fora em vez de rolar).
    <div className="scrollbar-none sticky top-15 z-20 w-full min-w-0 max-w-full overflow-x-auto border-b border-sidebar-border/70 bg-sidebar/95 backdrop-blur-md md:hidden print:hidden">
      <nav className="flex w-max gap-1.5 px-3 py-2 text-sidebar-foreground">
        {items.map((item) => {
          const active = itemAtivo(item, items, current);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border border-primary/25 bg-primary/15 text-primary"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50"
              }`}
            >
              <item.icon className={`h-3.5 w-3.5 ${active ? "stroke-[2.25px]" : "opacity-85"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
