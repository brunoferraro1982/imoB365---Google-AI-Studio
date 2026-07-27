import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { CobrarMercadoPagoButton } from "@/components/financeiro/CobrarMercadoPagoButton";

const TIPOS_PARCELA = [
  { value: "sinal", label: "Sinal" },
  { value: "entrada", label: "Entrada" },
  { value: "parcela", label: "Parcela" },
  { value: "quitacao", label: "Quitação" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pago: "default",
  pendente: "secondary",
  atrasado: "destructive",
  cancelado: "outline",
};

type Parcela = {
  id: string;
  numero: number;
  tipo: string;
  valor: number;
  data_vencimento: string;
  status: string;
  data_pagamento: string | null;
};

// Cronograma de pagamento de uma venda (sinal/entrada/parcelas/quitação) —
// só renderiza algo pra contratos tipo='venda'; o cronograma inicial é
// gerado automaticamente ao ativar o contrato (ver
// tg_gerar_parcelas_contrato), este componente cobre acompanhamento
// (marcar pago) e ajustes manuais (adicionar parcela avulsa, ex. quitação).
export function ParcelasSection({ contratoId }: { contratoId: string }) {
  const { tenantId } = useAuth();
  const [tipoContrato, setTipoContrato] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    tipo: "parcela",
    valor: "" as number | string,
    data_vencimento: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data: contrato } = await supabase
      .from("contratos")
      .select("tipo")
      .eq("id", contratoId)
      .maybeSingle();
    setTipoContrato(contrato?.tipo ?? null);

    const { data, error } = await (supabase as any)
      .from("contrato_parcelas")
      .select("id,numero,tipo,valor,data_vencimento,status,data_pagamento")
      .eq("contrato_id", contratoId)
      .order("numero");
    if (error) toast.error(error.message);
    setParcelas((data ?? []) as Parcela[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [contratoId]);

  async function marcarPago(id: string) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await (supabase as any)
      .from("contrato_parcelas")
      .update({ status: "pago", data_pagamento: hoje })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Parcela marcada como paga — lançamento criado no financeiro");
    load();
  }

  async function addParcela(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    const valor = Number(form.valor) || 0;
    if (valor <= 0) return toast.error("Informe um valor");
    if (!form.data_vencimento) return toast.error("Informe a data de vencimento");
    setSaving(true);
    const proximoNumero = (parcelas[parcelas.length - 1]?.numero ?? 0) + 1;
    const { error } = await (supabase as any).from("contrato_parcelas").insert({
      tenant_id: tenantId,
      contrato_id: contratoId,
      numero: proximoNumero,
      tipo: form.tipo,
      valor,
      data_vencimento: form.data_vencimento,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Parcela adicionada");
    setForm({ tipo: "parcela", valor: "", data_vencimento: "" });
    load();
  }

  if (loading) return null;
  if (tipoContrato !== "venda") return null;

  const total = parcelas.reduce((s, p) => s + Number(p.valor), 0);
  const totalPago = parcelas
    .filter((p) => p.status === "pago")
    .reduce((s, p) => s + Number(p.valor), 0);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Cronograma de pagamento</h2>
        {parcelas.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {formatBRL(totalPago)} pago de {formatBRL(total)}
          </span>
        )}
      </div>

      {parcelas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma parcela ainda. Preencha sinal/entrada/número de parcelas e ative o contrato pra
          gerar automaticamente, ou adicione uma parcela avulsa abaixo.
        </p>
      ) : (
        <div className="mb-6 space-y-2">
          {parcelas.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">#{p.numero}</span>
                  <Badge variant="secondary" className="capitalize">
                    {TIPOS_PARCELA.find((t) => t.value === p.tipo)?.label ?? p.tipo}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Vencimento:{" "}
                  {new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                  {p.data_pagamento &&
                    ` · Pago em: ${new Date(p.data_pagamento + "T12:00:00").toLocaleDateString("pt-BR")}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-medium">{formatBRL(p.valor)}</span>
                {p.status === "pendente" || p.status === "atrasado" ? (
                  <>
                    <CobrarMercadoPagoButton origemTipo="parcela" origemId={p.id} />
                    <Button variant="ghost" size="sm" onClick={() => marcarPago(p.id)}>
                      <Check className="mr-1 h-4 w-4" /> Marcar pago
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addParcela} className="grid gap-3 border-t border-border pt-4 md:grid-cols-4">
        <div>
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Tipo</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          >
            {TIPOS_PARCELA.map((t) => (
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
            value={form.data_vencimento}
            onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={saving} className="w-full">
            <Plus className="mr-1 h-4 w-4" /> Adicionar parcela
          </Button>
        </div>
      </form>
    </section>
  );
}
