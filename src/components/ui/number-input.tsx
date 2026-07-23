import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type NumberInputProps = {
  value: number | null;
  onChange: (v: number | null) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "type">;

// Input numérico controlado que guarda o texto digitado como string local,
// só ressincronizando do valor externo quando o campo não está com foco —
// evita o round-trip por Number() a cada tecla, que força o React a
// reescrever o DOM value/cursor a cada render e embaralha dígitos digitados
// rápido (ex.: o "." de "976509.78" sendo descartado no meio da digitação).
export function NumberInput({ value, onChange, ...props }: NumberInputProps) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value));
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(value == null ? "" : String(value));
        props.onBlur?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const trimmed = raw.trim().replace(",", ".");
        const n = trimmed === "" ? null : Number(trimmed);
        onChange(n === null || Number.isNaN(n) ? null : n);
      }}
    />
  );
}
