import { ArrowUp, ArrowDown, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Zona } from "@/lib/siteSections";

export type SectionItem = { key: string; label: string; visivel: boolean; zona?: Zona };

/**
 * Reordenação (setas cima/baixo) + toggle de visibilidade (ícone olho) para
 * as seções principais da home pública do tenant. Mesmo padrão de interação
 * já usado em app.site.widgets-conteudo.tsx para os widgets de sidebar —
 * aqui reaproveitado para um concern diferente (seções principais, não
 * sidebar), por isso extraído como componente compartilhado.
 *
 * Quando `zonas` é informado (layout 'amplo'), cada item ganha um seletor de
 * área e a reordenação (setas) passa a operar só dentro da mesma área — os
 * demais layouts (sem `zonas`) mantêm a reordenação global linear de sempre.
 */
export function SectionOrderEditor({
  items,
  onChange,
  pinnedLabel,
  zonas,
}: {
  items: SectionItem[];
  onChange: (next: SectionItem[]) => void;
  pinnedLabel?: string;
  zonas?: { key: Zona; label: string }[];
}) {
  function zonaOf(item: SectionItem): Zona {
    return item.zona ?? "content";
  }

  function sameZoneIndices(index: number): number[] {
    const zona = zonaOf(items[index]);
    return items.reduce<number[]>((acc, it, i) => {
      if (zonaOf(it) === zona) acc.push(i);
      return acc;
    }, []);
  }

  function isFirst(index: number): boolean {
    if (!zonas) return index === 0;
    const group = sameZoneIndices(index);
    return group[0] === index;
  }

  function isLast(index: number): boolean {
    if (!zonas) return index === items.length - 1;
    const group = sameZoneIndices(index);
    return group[group.length - 1] === index;
  }

  function move(index: number, dir: -1 | 1) {
    if (!zonas) {
      const target = index + dir;
      if (target < 0 || target >= items.length) return;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      onChange(next);
      return;
    }
    const group = sameZoneIndices(index);
    const posInGroup = group.indexOf(index);
    const targetPosInGroup = posInGroup + dir;
    if (targetPosInGroup < 0 || targetPosInGroup >= group.length) return;
    const targetIndex = group[targetPosInGroup];
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  }

  function toggle(index: number) {
    const next = [...items];
    next[index] = { ...next[index], visivel: !next[index].visivel };
    onChange(next);
  }

  function setZona(index: number, zona: Zona) {
    const moved = { ...items[index], zona };
    const rest = items.filter((_, i) => i !== index);
    // insere logo após o último item já pertencente à zona de destino
    // (ou no fim do array, se a zona ainda não tiver nenhum item)
    let insertAt = rest.length;
    for (let i = rest.length - 1; i >= 0; i--) {
      if (zonaOf(rest[i]) === zona) {
        insertAt = i + 1;
        break;
      }
    }
    onChange([...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)]);
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
          {zonas && (
            <Select value={zonaOf(item)} onValueChange={(v) => setZona(i, v as Zona)}>
              <SelectTrigger className="h-8 w-40 shrink-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zonas.map((z) => (
                  <SelectItem key={z.key} value={z.key}>
                    {z.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={isFirst(i)}
              onClick={() => move(i, -1)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={isLast(i)}
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
