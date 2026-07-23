import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type CityChipsInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
  id?: string;
};

// Texto livre (sem lista de municípios — ver migration 20260723120000), com
// limite de quantidade aplicado aqui no cliente via disabled do input, mesma
// lógica de cap já usada em CompararSelector.tsx.
export function CityChipsInput({ value, onChange, max = 3, placeholder, id }: CityChipsInputProps) {
  const [draft, setDraft] = useState("");
  const full = value.length >= max;

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed || full) {
      setDraft("");
      return;
    }
    if (value.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((city) => (
            <Badge key={city} variant="secondary" className="gap-1 pr-1">
              {city}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== city))}
                aria-label={`Remover ${city}`}
                className="rounded-full hover:bg-black/10"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        maxLength={80}
        disabled={full}
        placeholder={
          full ? `Máximo de ${max} cidades` : (placeholder ?? "Digite e pressione Enter")
        }
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {value.length}/{max} cidades
      </p>
    </div>
  );
}
