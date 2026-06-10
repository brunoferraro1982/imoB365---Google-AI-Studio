import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "imob365:comparar";
const MAX = 4;

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}
function writeIds(ids: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("comparar:change"));
}

const listeners = new Set<(ids: string[]) => void>();
if (typeof window !== "undefined") {
  window.addEventListener("comparar:change", () => {
    const ids = readIds();
    listeners.forEach((l) => l(ids));
  });
}

function useCompareList() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(readIds());
    const l = (next: string[]) => setIds(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return ids;
}

export function CompararCheckbox({
  imovelId,
  className,
}: {
  imovelId: string;
  className?: string;
}) {
  const ids = useCompareList();
  const checked = ids.includes(imovelId);
  const disabled = !checked && ids.length >= MAX;

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled && !checked) return;
    const next = checked ? ids.filter((x) => x !== imovelId) : [...ids, imovelId].slice(0, MAX);
    writeIds(next);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          toggle(e as any);
        }
      }}
      aria-label={checked ? "Remover do comparador" : "Adicionar ao comparador"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs backdrop-blur transition hover:bg-background cursor-pointer select-none",
        disabled && "cursor-not-allowed opacity-50 pointer-events-none",
        className,
      )}
    >
      <Checkbox checked={checked} disabled={disabled} className="pointer-events-none h-3.5 w-3.5" />
      <span>Comparar</span>
    </div>
  );
}

export function CompararBar() {
  const ids = useCompareList();
  if (ids.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Scale className="h-4 w-4 text-primary" />
          <span>
            <strong>{ids.length}</strong> {ids.length === 1 ? "imóvel" : "imóveis"} para comparar
            (máx. {MAX})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => writeIds([])}>
            <X className="mr-1.5 h-4 w-4" /> Limpar
          </Button>
          <Link to="/comparar" search={{ ids: ids.join(",") }}>
            <Button size="sm" disabled={ids.length < 2}>
              Comparar agora
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
