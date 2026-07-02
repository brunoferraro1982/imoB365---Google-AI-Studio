import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatCentavos(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface CurrencyInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> {
  value: number | string;
  onValueChange: (reais: number) => void;
}

// Input mascarado de moeda (padrão Real Brasileiro: milhar com "." e
// decimais com ","). Digita-se em centavos (da direita pra esquerda),
// como em caixas eletrônicos/apps bancários — evita erro de posicionar
// vírgula manualmente.
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, ...props }, ref) => {
    const reais = typeof value === "string" ? Number(value) || 0 : value;
    const cents = Math.round(reais * 100);
    const display = cents === 0 ? "" : formatCentavos(cents);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/\D/g, "");
      const newCents = digits === "" ? 0 : parseInt(digits, 10);
      onValueChange(newCents / 100);
    }

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          {...props}
          ref={ref}
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder={props.placeholder ?? "0,00"}
          className={cn("pl-9", className)}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
