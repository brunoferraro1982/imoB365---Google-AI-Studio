import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

type Props = { repasseId: string };

const STATUSES: { v: string; l: string }[] = [
  { v: "pendente", l: "Pendente" },
  { v: "recebido", l: "Aluguel recebido" },
  { v: "repassado", l: "Repassado" },
];

export function RepasseForm({ repasseId }: Props) {
  const navigate = useNavigate();
  const [form, setForm] = useState<any>(null);
  const [contrato, setContrato] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("locacao_repasses")
        .select("*, contrato:contratos(id,numero,imovel:imoveis(id,titulo))")
        .eq("id", repasseId)
        .maybeSingle();
      if (error) toast.error(error.message);
      if (data) {
        setContrato(data.contrato ?? null);
        setForm({
          valor_aluguel: data.valor_aluguel ?? 0,
          taxa_admin_percentual: data.taxa_admin_percentual ?? 0,
          outros_descontos: data.outros_descontos ?? 0,
          status: data.status ?? "pendente",
          data_recebimento: data.data_recebimento ?? "",
          data_repasse: data.data_repasse ?? "",
          observacoes: data.observacoes ?? "",
        });
      }
      setLoading(false);
    })();
  }, [repasseId]);

  function set(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  // Repasse líquido = aluguel - (aluguel * taxa%) - outros descontos. Sempre
  // derivado, nunca digitado direto — evita o valor final divergir da conta.
  const taxaAdminValor = useMemo(() => {
    if (!form) return 0;
    return (Number(form.valor_aluguel) || 0) * ((Number(form.taxa_admin_percentual) || 0) / 100);
  }, [form?.valor_aluguel, form?.taxa_admin_percentual]);

  const valorRepasse = useMemo(() => {
    if (!form) return 0;
    return (
      (Number(form.valor_aluguel) || 0) - taxaAdminValor - (Number(form.outros_descontos) || 0)
    );
  }, [form?.valor_aluguel, form?.outros_descontos, taxaAdminValor]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("locacao_repasses")
      .update({
        valor_aluguel: Number(form.valor_aluguel) || 0,
        taxa_admin_percentual: Number(form.taxa_admin_percentual) || 0,
        taxa_admin_valor: taxaAdminValor,
        outros_descontos: Number(form.outros_descontos) || 0,
        valor_repasse: valorRepasse,
        status: form.status,
        data_recebimento: form.data_recebimento || null,
        data_repasse: form.data_repasse || null,
        observacoes: form.observacoes || null,
      })
      .eq("id", repasseId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Repasse atualizado");
    navigate({ to: "/app/locacao/repasses" });
  }

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!form)
    return (
      <div className="text-sm text-muted-foreground">
        Não foi possível carregar este repasse. Volte e tente novamente.
      </div>
    );

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Contrato</h2>
        <p className="text-sm text-muted-foreground">
          {contrato?.imovel?.titulo ?? contrato?.numero ?? "—"}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Valores</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Valor do aluguel (R$)">
            <Input
              type="number"
              step="0.01"
              value={form.valor_aluguel}
              onChange={(e) => set("valor_aluguel", e.target.value)}
            />
          </Field>
          <Field label="Taxa de administração (%)">
            <Input
              type="number"
              step="0.01"
              value={form.taxa_admin_percentual}
              onChange={(e) => set("taxa_admin_percentual", e.target.value)}
            />
          </Field>
          <Field label="Outros descontos (R$)">
            <Input
              type="number"
              step="0.01"
              value={form.outros_descontos}
              onChange={(e) => set("outros_descontos", e.target.value)}
            />
          </Field>
          <Field label="Repasse líquido (calculado)">
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold">
              {formatBRL(valorRepasse)}
            </div>
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Status</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Status">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data de recebimento">
            <Input
              type="date"
              value={form.data_recebimento}
              onChange={(e) => set("data_recebimento", e.target.value)}
            />
          </Field>
          <Field label="Data do repasse">
            <Input
              type="date"
              value={form.data_repasse}
              onChange={(e) => set("data_repasse", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Observações</h2>
        <Textarea
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </section>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/app/locacao/repasses" })}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
