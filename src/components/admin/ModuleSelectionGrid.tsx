import { Check, Package, ShieldCheck, CheckSquare, Square, Coins } from "lucide-react";
import { formatQuota } from "@/lib/format";

type GridModule = {
  slug: string;
  nome: string;
  descricao: string | null;
  versao?: string;
};

type ModuleSelectionGridProps = {
  coreModules: GridModule[];
  optionalModules: GridModule[];
  selected: Record<string, boolean>;
  onToggle: (slug: string) => void;
  /** -1 = ilimitado */
  quota: number;
  /** Se informado, exibe o custo de excedente (usado no self-service de /app/contratacao). */
  costPerExtra?: number;
};

export function ModuleSelectionGrid({
  coreModules,
  optionalModules,
  selected,
  onToggle,
  quota,
  costPerExtra,
}: ModuleSelectionGridProps) {
  const unlimited = quota === -1;
  const selectedCount = optionalModules.filter((m) => selected[m.slug]).length;
  const remaining = unlimited ? Infinity : Math.max(0, quota - selectedCount);
  const overCount = unlimited ? 0 : Math.max(0, selectedCount - quota);

  return (
    <div>
      <div className="mb-5 flex shrink-0 items-center justify-between gap-4 rounded-xl border border-border bg-neutral-50 px-4 py-2 text-xs dark:bg-neutral-900">
        <div>
          <span className="text-muted-foreground">Módulos usados:</span>{" "}
          <strong className="text-foreground">{selectedCount}</strong>
          <span className="text-muted-foreground"> / {formatQuota(quota)}</span>
        </div>
        {!unlimited && <div className="h-4.5 w-px bg-border/80" />}
        {!unlimited && (
          <div>
            {remaining > 0 ? (
              <span className="font-bold text-emerald-500">+{remaining} extras inclusos</span>
            ) : overCount > 0 ? (
              <span className="font-bold text-primary">
                +{overCount} excedente
                {costPerExtra ? ` (+R$ ${overCount * costPerExtra}/mês)` : ""}
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">Cota exata atingida</span>
            )}
          </div>
        )}
      </div>

      <div className="mb-6">
        <span className="mb-2.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-emerald-500" /> Módulos básicos inclusos (sempre
          ativos)
        </span>
        <div className="grid gap-3 sm:grid-cols-3">
          {coreModules.map((m) => (
            <div
              key={m.slug}
              className="relative flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-3.5 dark:bg-emerald-500/[0.01]"
            >
              <div className="mt-0.5 shrink-0 rounded-full bg-emerald-500/10 p-1 text-emerald-500">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">{m.nome}</h4>
                {m.descricao && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {m.descricao}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-3 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
          <Package className="h-3 w-3 text-primary" /> Módulos avançados plugáveis (opcionais)
        </span>
        <div className="grid gap-4.5 sm:grid-cols-2">
          {optionalModules.map((m) => {
            const isChecked = !!selected[m.slug];
            const overLimit = !unlimited && !isChecked && selectedCount >= quota;
            return (
              <button
                key={m.slug}
                type="button"
                onClick={() => onToggle(m.slug)}
                className={`relative flex w-full cursor-pointer select-none gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                  isChecked
                    ? "border-primary bg-primary/[0.01] shadow-2xs"
                    : "border-border hover:border-border/80 hover:bg-neutral-50/20"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isChecked ? (
                    <CheckSquare className="h-5 w-5 stroke-[2.25px] text-primary" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground/60" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">{m.nome}</h4>
                    {overLimit && costPerExtra && (
                      <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600">
                        <Coins className="h-2.5 w-2.5 animate-bounce" /> + R$ {costPerExtra}/mês
                      </span>
                    )}
                  </div>
                  {m.descricao && (
                    <p className="mt-1.5 text-xs leading-normal text-muted-foreground">
                      {m.descricao}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-muted-foreground/80">
                    {m.versao && <span>Desenvolvimento: v{m.versao}</span>}
                    {isChecked && <span className="font-bold text-primary">Ativado</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
