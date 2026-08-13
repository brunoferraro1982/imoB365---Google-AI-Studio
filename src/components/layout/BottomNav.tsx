/**
 * Bottom navigation mobile do /app — barra fixa inferior estilo app nativo,
 * visível só no mobile (lg:hidden). Substitui, no mobile, a nav superior de
 * módulos (que ficava amontoada/rolável no header). Reusa `visibleModules` da
 * AppShell (já filtrado por papel/plano), então nunca mostra um módulo que o
 * usuário não pode acessar. Respeita a safe-area do iOS (pb-safe).
 *
 * Mostra até 4 módulos "primários" (ordem preferida) + um botão "Mais" que
 * abre um Sheet com TODOS os módulos visíveis — garante acesso ao que não
 * coube na barra.
 */
import { Link, useLocation } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

type Item = { to: string; label: string; icon: typeof MoreHorizontal };
type Module = { id: string; label: string; icon: typeof MoreHorizontal; items: Item[] };

// Ordem preferida na barra (os que existirem em visibleModules entram, até 4).
const PRIMARIOS = ["dashboard", "imobiliario", "financeiro", "atendimento", "site", "marketing"];

// Rótulos curtos pra barra (o label do módulo às vezes é longo demais p/ mobile).
const CURTO: Record<string, string> = {
  dashboard: "Início",
  imobiliario: "Imóveis",
  financeiro: "Financeiro",
  atendimento: "Atend.",
  site: "Site",
  marketing: "Mkt",
  juridico: "Jurídico",
  elearning: "Cursos",
  ajustes: "Config",
};

function moduloAtivo(mod: Module, pathname: string): boolean {
  return mod.items.some((it) => pathname === it.to || pathname.startsWith(it.to + "/"));
}

export function BottomNav({ modules }: { modules: Module[] }) {
  const { pathname } = useLocation();
  const [maisAberto, setMaisAberto] = useState(false);

  const naBarra = PRIMARIOS.map((id) => modules.find((m) => m.id === id))
    .filter((m): m is Module => Boolean(m))
    .slice(0, 4);

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-sidebar-border/85 bg-sidebar/98 text-sidebar-foreground backdrop-blur-md lg:hidden print:hidden">
      {naBarra.map((m) => {
        const active = moduloAtivo(m, pathname);
        return (
          <Link
            key={m.id}
            to={m.items[0].to}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              active ? "text-primary" : "text-sidebar-foreground/70"
            }`}
          >
            <m.icon className={`h-5 w-5 ${active ? "stroke-[2.25px]" : "opacity-85"}`} />
            <span className="max-w-full truncate px-1">{CURTO[m.id] ?? m.label}</span>
          </Link>
        );
      })}

      <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
        <SheetTrigger asChild>
          <button
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-sidebar-foreground/70"
            aria-label="Mais opções"
          >
            <MoreHorizontal className="h-5 w-5 opacity-85" />
            <span>Mais</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">Navegação</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 py-3">
            {modules.map((m) => {
              const active = moduloAtivo(m, pathname);
              return (
                <Link
                  key={m.id}
                  to={m.items[0].to}
                  onClick={() => setMaisAberto(false)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-colors ${
                    active
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <m.icon className="h-6 w-6" />
                  <span className="leading-tight">{m.label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
