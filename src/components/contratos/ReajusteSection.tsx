import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

// Primeira UI real sobre locacao_reajustes — a tabela existe desde
// 2026-05-21 (schema, RLS e trigger de updated_at prontos) mas nunca teve
// nenhum código consumidor até este sprint.
const INDICES = ["IGPM", "IPCA", "INPC", "Outro"];

type Reajuste = {
  id: string;
  indice: string;
  periodicidade_meses: number;
  ultimo_reajuste: string | null;
  proximo_reajuste: string | null;
  ultimo_valor: number | null;
};

function addMeses(dataIso: string, meses: number): string {
  const d = new Date(dataIso);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

export function ReajusteSection({ contratoId }: { contratoId: string }) {
  const { tenantId } = useAuth();
  const [reajuste, setReajuste] = useState<Reajuste | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ indice: "IGPM", periodicidadeMeses: "12" });
  const [novoValor, setNovoValor] = useState<number | string>("");

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("locacao_reajustes")
      .select("id,indice,periodicidade_meses,ultimo_reajuste,proximo_reajuste,ultimo_valor")
      .eq("contrato_id", contratoId)
      .maybeSingle();
    if (data) {
      setReajuste(data as Reajuste);
      setForm({
        indice: data.indice,
        periodicidadeMeses: String(data.periodicidade_meses),
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [contratoId]);

  async function salvarConfig(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    const proximoReajuste = addMeses(
      new Date().toISOString().slice(0, 10),
      Number(form.periodicidadeMeses) || 12,
    );
    const payload = {
      tenant_id: tenantId,
      contrato_id: contratoId,
      indice: form.indice,
      periodicidade_meses: Number(form.periodicidadeMeses) || 12,
      proximo_reajuste: reajuste?.proximo_reajuste ?? proximoReajuste,
    };
    const { error } = reajuste
      ? await (supabase as any).from("locacao_reajustes").update(payload).eq("id", reajuste.id)
      : await (supabase as any).from("locacao_reajustes").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração de reajuste salva");
    load();
  }

  async function aplicarReajuste() {
    if (!reajuste || !novoValor) return toast.error("Informe o novo valor do aluguel");
    setSaving(true);
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await (supabase as any)
      .from("locacao_reajustes")
      .update({
        ultimo_reajuste: hoje,
        ultimo_valor: Number(novoValor),
        proximo_reajuste: addMeses(hoje, reajuste.periodicidade_meses),
      })
      .eq("id", reajuste.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Reajuste aplicado — atualize o valor do aluguel em Dados gerais, se confirmado");
    setNovoValor("");
    load();
  }

  if (loading) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold">
        <TrendingUp className="h-4 w-4" /> Reajuste do aluguel
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Índice e periodicidade de correção monetária — controla quando o próximo reajuste vence.
      </p>

      <form onSubmit={salvarConfig} className="grid gap-4 md:grid-cols-3">
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Índice</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.indice}
            onChange={(e) => setForm((f) => ({ ...f, indice: e.target.value }))}
          >
            {INDICES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
            Periodicidade (meses)
          </Label>
          <Input
            type="number"
            min="1"
            step="1"
            value={form.periodicidadeMeses}
            onChange={(e) => setForm((f) => ({ ...f, periodicidadeMeses: e.target.value }))}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={saving} variant="outline" className="w-full">
            {reajuste ? "Atualizar configuração" : "Configurar reajuste"}
          </Button>
        </div>
      </form>

      {reajuste && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Próximo reajuste</span>
              <div className="font-medium">
                {reajuste.proximo_reajuste
                  ? new Date(`${reajuste.proximo_reajuste}T00:00:00`).toLocaleDateString("pt-BR")
                  : "—"}
              </div>
            </div>
            {reajuste.ultimo_reajuste && (
              <div>
                <span className="text-xs text-muted-foreground">Último reajuste aplicado</span>
                <div className="font-medium">
                  {new Date(`${reajuste.ultimo_reajuste}T00:00:00`).toLocaleDateString("pt-BR")}
                  {reajuste.ultimo_valor != null &&
                    ` — novo valor: R$ ${reajuste.ultimo_valor.toLocaleString("pt-BR")}`}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                Registrar reajuste aplicado (novo valor do aluguel)
              </Label>
              <CurrencyInput value={novoValor} onValueChange={setNovoValor} />
            </div>
            <Button type="button" onClick={aplicarReajuste} disabled={saving || !novoValor}>
              Registrar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
