import { useTheme } from "@/components/theme/ThemeProvider";
import { TEMA_OPCOES } from "@/components/layout/UserMenu";

/** Seletor em botões (Claro / Escuro / Automático) para menus em painel (Sheet). */
export function TemaSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="grid grid-cols-3 gap-1 rounded-lg bg-sidebar-accent/40 p-1"
    >
      {TEMA_OPCOES.map((o) => {
        const ativo = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => setTheme(o.value)}
            className={`flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium transition-colors ${
              ativo
                ? "bg-primary/20 text-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
            }`}
          >
            <o.icon className="h-4 w-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
