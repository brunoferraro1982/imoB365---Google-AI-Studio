import { ArrowUp, ArrowDown, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type SectionItem = { key: string; label: string; visivel: boolean };

/**
 * Reordenação (setas cima/baixo) + toggle de visibilidade (ícone olho) para
 * as seções principais da home pública do tenant. Mesmo padrão de interação
 * já usado em app.site.widgets-conteudo.tsx para os widgets de sidebar —
 * aqui reaproveitado para um concern diferente (seções principais, não
 * sidebar), por isso extraído como componente compartilhado.
 */
export function SectionOrderEditor({
  items,
  onChange,
  pinnedLabel,
}: {
  items: SectionItem[];
  onChange: (next: SectionItem[]) => void;
  pinnedLabel?: string;
}) {
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function toggle(index: number) {
    const next = [...items];
    next[index] = { ...next[index], visivel: !next[index].visivel };
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {pinnedLabel && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 opacity-70">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{pinnedLabel}</p>
            <p className="text-xs text-muted-foreground">Sempre a primeira seção</p>
          </div>
        </div>
      )}
      {items.map((item, i) => (
        <div
          key={item.key}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{item.label}</p>
          </div>
          {!item.visivel && (
            <Badge variant="outline" className="shrink-0">
              Oculta
            </Badge>
          )}
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => toggle(i)}
            >
              {item.visivel ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
