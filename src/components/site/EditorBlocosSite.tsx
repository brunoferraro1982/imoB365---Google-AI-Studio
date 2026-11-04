import { RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ICONES_SITE, iconeSite, type IconeSite } from "@/components/site/sections/ui";
import {
  COMO_FUNCIONA_PADRAO,
  DIFERENCIAIS_PADRAO,
  itensOuPadrao,
  type Diferencial,
  type Passo,
} from "@/lib/siteSections";

const ROTULO_ICONE: Record<IconeSite, string> = {
  shield: "Escudo",
  search: "Lupa",
  file: "Documento",
  key: "Chave",
  home: "Casa",
  handshake: "Aperto de mão",
  star: "Estrela",
  heart: "Coração",
  users: "Pessoas",
  trending: "Valorização",
  map: "Localização",
  calendar: "Agenda",
  building: "Prédio",
  sparkles: "Brilho",
  badge: "Selo",
};

/** Editor dos 3 cartões "Diferenciais" do site (ícone + título + texto). */
export function DiferenciaisEditor({
  valor,
  onChange,
}: {
  valor: unknown;
  onChange: (v: Diferencial[]) => void;
}) {
  const itens = itensOuPadrao<Diferencial>(valor, DIFERENCIAIS_PADRAO).slice(0, 3);
  while (itens.length < 3) itens.push({ icone: "sparkles", titulo: "", texto: "" });
  const atualizar = (i: number, campo: keyof Diferencial, v: string) =>
    onChange(itens.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it)));

  return (
    <div className="space-y-3">
      {itens.map((d, i) => {
        const Icone = iconeSite(d.icone);
        return (
          <div
            key={i}
            className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[190px_1fr]"
          >
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icone className="h-4 w-4" />
              </span>
              <select
                value={d.icone}
                onChange={(e) => atualizar(i, "icone", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                aria-label={`Ícone do diferencial ${i + 1}`}
              >
                {(Object.keys(ICONES_SITE) as IconeSite[]).map((k) => (
                  <option key={k} value={k}>
                    {ROTULO_ICONE[k]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2">
              <Input
                value={d.titulo}
                maxLength={80}
                placeholder={`Título do diferencial ${i + 1}`}
                onChange={(e) => atualizar(i, "titulo", e.target.value)}
              />
              <Textarea
                rows={2}
                value={d.texto}
                maxLength={240}
                placeholder="Texto curto"
                onChange={(e) => atualizar(i, "texto", e.target.value)}
              />
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => onChange(DIFERENCIAIS_PADRAO)}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Voltar ao texto padrão
      </Button>
    </div>
  );
}

/** Editor dos 3 passos do bloco "Como funciona". */
export function PassosEditor({
  valor,
  onChange,
}: {
  valor: unknown;
  onChange: (v: Passo[]) => void;
}) {
  const itens = itensOuPadrao<Passo>(valor, COMO_FUNCIONA_PADRAO).slice(0, 3);
  while (itens.length < 3) itens.push({ titulo: "", texto: "" });
  const atualizar = (i: number, campo: keyof Passo, v: string) =>
    onChange(itens.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it)));

  return (
    <div className="space-y-3">
      {itens.map((p, i) => (
        <div
          key={i}
          className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[36px_1fr]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {i + 1}
          </span>
          <div className="grid gap-2">
            <Input
              value={p.titulo}
              maxLength={80}
              placeholder={`Passo ${i + 1}`}
              onChange={(e) => atualizar(i, "titulo", e.target.value)}
            />
            <Textarea
              rows={2}
              value={p.texto}
              maxLength={240}
              placeholder="Texto curto"
              onChange={(e) => atualizar(i, "texto", e.target.value)}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => onChange(COMO_FUNCIONA_PADRAO)}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Voltar ao texto padrão
      </Button>
    </div>
  );
}
