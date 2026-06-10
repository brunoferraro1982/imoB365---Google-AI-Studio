import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/format";

export type CorretorFormData = {
  nome: string;
  email: string;
  telefone: string;
  whatsapp: string;
  creci: string;
  creci_uf: string;
  cargo: string;
  bio: string;
  slug: string;
  comissao_padrao: number | null;
  ativo: boolean;
  publico: boolean;
};

export const emptyCorretor: CorretorFormData = {
  nome: "",
  email: "",
  telefone: "",
  whatsapp: "",
  creci: "",
  creci_uf: "",
  cargo: "",
  bio: "",
  slug: "",
  comissao_padrao: null,
  ativo: true,
  publico: true,
};

export function CorretorForm({
  initial,
  onSubmit,
  submitLabel,
  submitting,
}: {
  initial?: Partial<CorretorFormData>;
  onSubmit: (data: CorretorFormData) => Promise<void> | void;
  submitLabel: string;
  submitting?: boolean;
}) {
  const [data, setData] = useState<CorretorFormData>({ ...emptyCorretor, ...initial });

  function update<K extends keyof CorretorFormData>(k: K, v: CorretorFormData[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ ...data, slug: data.slug || slugify(data.nome) });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section title="Dados pessoais">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome completo *">
            <Input required value={data.nome} onChange={(e) => update("nome", e.target.value)} />
          </Field>
          <Field label="Cargo / Função">
            <Input
              value={data.cargo}
              onChange={(e) => update("cargo", e.target.value)}
              placeholder="Corretor associado, Diretor, etc."
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={data.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
          <Field label="Telefone">
            <Input
              value={data.telefone}
              onChange={(e) => update("telefone", e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={data.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </Field>
          <Field label="URL pública (slug)">
            <Input
              value={data.slug}
              onChange={(e) => update("slug", e.target.value)}
              placeholder="gerado a partir do nome"
            />
          </Field>
        </div>
      </Section>

      <Section title="CRECI">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Número do CRECI">
            <Input value={data.creci} onChange={(e) => update("creci", e.target.value)} />
          </Field>
          <Field label="UF">
            <Input
              maxLength={2}
              value={data.creci_uf}
              onChange={(e) => update("creci_uf", e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Comissão padrão (%)">
            <Input
              type="number"
              step="0.01"
              value={data.comissao_padrao ?? ""}
              onChange={(e) =>
                update("comissao_padrao", e.target.value ? Number(e.target.value) : null)
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Apresentação pública">
        <Field label="Biografia">
          <Textarea
            rows={5}
            value={data.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="Breve descrição que aparece na página pública do corretor"
          />
        </Field>
      </Section>

      <Section title="Status">
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle
            label="Ativo na equipe"
            checked={data.ativo}
            onChange={(v) => update("ativo", v)}
          />
          <Toggle
            label="Visível no site público"
            checked={data.publico}
            onChange={(v) => update("publico", v)}
          />
        </div>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
