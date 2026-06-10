import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = { lancamentoId?: string };

const TIPOS = [
  { v: "receita", l: "Receita" },
  { v: "despesa", l: "Despesa" },
];
const STATUSES = [
  { v: "pendente", l: "Pendente" },
  { v: "pago", l: "Pago" },
  { v: "atrasado", l: "Atrasado" },
  { v: "cancelado", l: "Cancelado" },
];

export function LancamentoForm({ lancamentoId }: Props) {
  const { tenantId, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({
    tipo: "receita",
    categoria: "",
    descricao: "",
    valor: 0,
    data_vencimento: new Date().toISOString().slice(0, 10),
    data_pagamento: "",
    status: "pendente",
    contrato_id: "",
    imovel_id: "",
    corretor_id: "",
    observacoes: "",
  });
  const [contratos, setContratos] = useState<any[]>([]);
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [corretores, setCorretores] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!lancamentoId);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [{ data: c }, { data: i }, { data: co }] = await Promise.all([
        supabase
          .from("contratos")
          .select("id,numero,tipo")
          .eq("tenant_id", tenantId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("imoveis")
          .select("id,titulo,codigo_interno")
          .eq("tenant_id", tenantId)
          .order("titulo"),
        supabase
          .from("corretores")
          .select("id,nome")
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .order("nome"),
      ]);
      setContratos(c ?? []);
      setImoveis(i ?? []);
      setCorretores(co ?? []);
    })();
  }, [tenantId]);

  useEffect(() => {
    if (!lancamentoId) return;
    (async () => {
      const { data } = await supabase
        .from("lancamentos_financeiros")
        .select("*")
        .eq("id", lancamentoId)
        .maybeSingle();
      if (data)
        setForm({
          ...data,
          categoria: data.categoria ?? "",
          data_pagamento: data.data_pagamento ?? "",
          contrato_id: data.contrato_id ?? "",
          imovel_id: data.imovel_id ?? "",
          corretor_id: data.corretor_id ?? "",
          observacoes: data.observacoes ?? "",
        });
      setLoading(false);
    })();
  }, [lancamentoId]);

  function set(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return toast.error("Sem tenant");
    setSaving(true);
    const payload: any = {
      tenant_id: tenantId,
      tipo: form.tipo,
      categoria: form.categoria || null,
      descricao: form.descricao,
      valor: Number(form.valor) || 0,
      data_vencimento: form.data_vencimento,
      data_pagamento: form.data_pagamento || null,
      status: form.status,
      contrato_id: form.contrato_id || null,
      imovel_id: form.imovel_id || null,
      corretor_id: form.corretor_id || null,
      observacoes: form.observacoes || null,
    };
    if (lancamentoId) {
      const { error } = await supabase
        .from("lancamentos_financeiros")
        .update(payload)
        .eq("id", lancamentoId);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      toast.success("Lançamento atualizado");
      navigate({ to: "/app/financeiro" });
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from("lancamentos_financeiros").insert(payload);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      toast.success("Lançamento criado");
      navigate({ to: "/app/financeiro" });
    }
    setSaving(false);
  }

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Lançamento</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo *">
            <select
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.tipo}
              onChange={(e) => set("tipo", e.target.value)}
            >
              {TIPOS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </Field>
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
          <Field label="Descrição *">
            <Input
              required
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              maxLength={300}
            />
          </Field>
          <Field label="Categoria">
            <Input
              value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}
              maxLength={80}
              placeholder="ex.: comissão, aluguel, marketing…"
            />
          </Field>
          <Field label="Valor (R$) *">
            <Input
              required
              type="number"
              step="0.01"
              value={form.valor}
              onChange={(e) => set("valor", e.target.value)}
            />
          </Field>
          <Field label="Data de vencimento *">
            <Input
              required
              type="date"
              value={form.data_vencimento}
              onChange={(e) => set("data_vencimento", e.target.value)}
            />
          </Field>
          <Field label="Data de pagamento">
            <Input
              type="date"
              value={form.data_pagamento}
              onChange={(e) => set("data_pagamento", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Vínculos (opcional)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Contrato">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.contrato_id}
              onChange={(e) => set("contrato_id", e.target.value)}
            >
              <option value="">—</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero ?? c.id.slice(0, 8)} ({c.tipo})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Imóvel">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.imovel_id}
              onChange={(e) => set("imovel_id", e.target.value)}
            >
              <option value="">—</option>
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.titulo}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Corretor">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.corretor_id}
              onChange={(e) => set("corretor_id", e.target.value)}
            >
              <option value="">—</option>
              {corretores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
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
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/financeiro" })}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : lancamentoId ? "Salvar alterações" : "Criar lançamento"}
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
