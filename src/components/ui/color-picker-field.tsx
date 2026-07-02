import { Input } from "@/components/ui/input";

interface ColorPickerFieldProps {
  value: string;
  onChange: (hex: string) => void;
  presets?: { label: string; value: string }[];
  id?: string;
}

const DEFAULT_PRESETS = [
  { label: "Laranja imoB365", value: "#F2762E" },
  { label: "Azul confiança", value: "#005CAB" },
  { label: "Verde WhatsApp", value: "#25D366" },
  { label: "Roxo premium", value: "#6D28D9" },
  { label: "Preto elegante", value: "#111827" },
];

const HEX_RE = /^#([0-9a-fA-F]{3}){1,2}$/;

/**
 * Seletor de cor amigável: nunca exige que a pessoa saiba um código hex de
 * cor — ela clica na amostra (abre o seletor nativo do navegador) ou escolhe
 * um preset de marca já pronto. O campo de texto existe só para quem já sabe
 * o código e quer digitar direto.
 */
export function ColorPickerField({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  id,
}: ColorPickerFieldProps) {
  const safeColor = HEX_RE.test(value) ? value : "#F2762E";

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <input
          id={id}
          type="color"
          value={safeColor}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-input p-0"
          aria-label="Escolher cor"
        />
        <Input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#F2762E"
          maxLength={20}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            title={p.label}
            onClick={() => onChange(p.value)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <span
              className="h-3 w-3 rounded-full border border-black/10"
              style={{ backgroundColor: p.value }}
            />
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
