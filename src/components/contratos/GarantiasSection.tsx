import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Trash2 } from "lucide-react";

// Primeira UI real sobre locacao_garantias — a tabela existe desde
// 2026-05-21 (schema, RLS e trigger prontos) mas nunca teve nenhum código
// consumidor até este sprint.
const TIPOS_GARANTIA = [
  { value: "fiador", label: "Fiador" },
  { value: "seguro_fianca", label: "Seguro-fiança" },
  { value: "titulo_capitalizacao", label: "Título de capitalização" },
  { value: "caucao", label: "Caução" },
  { value: "credpago", label: "CredPago" },
  { value: "porto_seguro", label: "Porto Seguro" },
  { value: "tokio_marine", label: "Tokio Marine" },
  { value: "outro", label: "Outro" },
];

const TIPO_LABEL_MAP = Object.fromEntries(TIPOS_GARANTIA.map((t) => [t.value, t.label]));

type Garantia = {
  id: string;
  tipo: string;
  valor: number | null;
  vencimento: string | null;
  ativo: boolean;
  dados: { observacoes?: string } | null;
};

export function GarantiasSection({ contratoId }: { contratoId: string }) {
  const { tenantId } = useAuth();
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: "fiador",
    valor: "" as number | string,
    vencimento: "",
    observacoes: "",
  });

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("locacao_garantias")
      .select("id,tipo,valor,vencimento,ativo,dados")
      .eq("contrato_id", contratoId)
      .order("created_at", { ascending: false });
    setGarantias((data ?? []) as Garantia[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [contratoId]);

  async function addGarantia(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    const { error } = await (supabase as any).from("locacao_garantias").insert({
      tenant_id: tenantId,
      contrato_id: contratoId,
      tipo: form.tipo,
      valor: form.valor === "" ? null : Number(form.valor),
      vencimento: form.vencimento || null,
      dados: form.observacoes ? { observacoes: form.observacoes } : {},
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Garantia cadastrada");
    setForm({ tipo: "fiador", valor: "", vencimento: "", observacoes: "" });
    load();
  }

  async function toggleAtivo(g: Garantia) {
    const { error } = await (supabase as any)
      .from("locacao_garantias")
      .update({ ativo: !g.ativo })
      .eq("id", g.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remover esta garantia?")) return;
    const { error } = await (supabase as any).from("locacao_garantias").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  if (loading) return null;

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold">
        <ShieldCheck className="h-4 w-4" /> Garantias
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Fiador, seguro-fiança, caução ou título de capitalização — controle de validade.
      </p>

      {garantias.length > 0 && (
        <div className="mb-4 space-y-2">
          {garantias.map((g) => {
            const vencida = g.vencimento != null && g.vencimento < hoje;
            return (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{TIPO_LABEL_MAP[g.tipo] ?? g.tipo}</Badge>
                    {!g.ativo && <Badge variant="outline">Inativa</Badge>}
                    {vencida && g.ativo && <Badge variant="destructive">Vencida</Badge>}
                    {g.valor != null && (
                      <span className="text-xs text-muted-foreground">
                        R$ {g.valor.toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {g.vencimento
                      ? `Vencimento: ${new Date(`${g.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}`
                      : "Sem vencimento"}
                    {g.dados?.observacoes && ` · ${g.dados.observacoes}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleAtivo(g)}>
                    {g.ativo ? "Desativar" : "Reativar"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(g.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form
        onSubmit={addGarantia}
        className="grid gap-3 border-t border-border pt-4 md:grid-cols-4"
      >
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Tipo</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          >
            {TIPOS_GARANTIA.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Valor (R$)</Label>
          <CurrencyInput
            value={form.valor}
            onValueChange={(v) => setForm((f) => ({ ...f, valor: v }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Vencimento</Label>
          <Input
            type="date"
            value={form.vencimento}
            onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={saving} className="w-full">
            Adicionar
          </Button>
        </div>
        <div className="md:col-span-4">
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Detalhes (apólice, número da caução, dados do fiador…)
          </Label>
          <Input
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            maxLength={300}
          />
        </div>
      </form>

      {form.tipo === "fiador" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Cadastre também a pessoa do fiador na seção "Partes do contrato" acima, com o papel
          "Fiador".
        </p>
      )}
    </section>
  );
}
