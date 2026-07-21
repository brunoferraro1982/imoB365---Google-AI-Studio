import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ComissaoStatus = Database["public"]["Enums"]["comissao_status"];

type Props = { comissaoId?: string; contratoIdInicial?: string };

const STATUSES: { v: ComissaoStatus; l: string }[] = [
  { v: "a_pagar", l: "A pagar" },
  { v: "paga", l: "Paga" },
  { v: "cancelada", l: "Cancelada" },
];

export function ComissaoForm({ comissaoId, contratoIdInicial }: Props) {
  const { tenantId, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({
    contrato_id: contratoIdInicial ?? "",
    corretor_id: "",
    percentual: "",
    valor: 0,
    status: "a_pagar" as ComissaoStatus,
    data_prevista: new Date().toISOString().slice(0, 10),
    data_pagamento: "",
    observacoes: "",
  });
  const [contratos, setContratos] = useState<any[]>([]);
  const [corretores, setCorretores] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!comissaoId);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [{ data: c }, { data: co }] = await Promise.all([
        supabase
          .from("contratos")
          .select("id,numero,tipo")
          .eq("tenant_id", tenantId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("corretores")
          .select("id,nome")
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .order("nome"),
      ]);
      setContratos(c ?? []);
      setCorretores(co ?? []);
    })();
  }, [tenantId]);

  useEffect(() => {
    if (!comissaoId) return;
    (async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("*")
        .eq("id", comissaoId)
        .maybeSingle();
      if (data)
        setForm({
          ...data,
          contrato_id: data.contrato_id ?? "",
          percentual: data.percentual ?? "",
          data_prevista: data.data_prevista ?? "",
          data_pagamento: data.data_pagamento ?? "",
          observacoes: data.observacoes ?? "",
        });
      setLoading(false);
    })();
  }, [comissaoId]);

  // Ao vir de um contrato específico (link "Gerar comissão" em
  // app.contratos.$id.tsx), pré-preenche corretor/percentual/valor com os
  // dados do próprio contrato — mesmo cálculo que o botão antigo fazia
  // antes de virar uma navegação pra este formulário.
  useEffect(() => {
    if (!contratoIdInicial || comissaoId) return;
    (async () => {
      const { data: c } = await supabase
        .from("contratos")
        .select("comissao_valor,comissao_percentual,corretor_id,valor")
        .eq("id", contratoIdInicial)
        .maybeSingle();
      if (!c) return;
      const valorSugerido =
        c.comissao_valor ??
        (c.comissao_percentual ? (Number(c.valor) * Number(c.comissao_percentual)) / 100 : 0);
      setForm((f: any) => ({
        ...f,
        corretor_id: f.corretor_id || c.corretor_id || "",
        percentual: f.percentual === "" ? (c.comissao_percentual ?? "") : f.percentual,
        valor: valorSugerido || f.valor,
      }));
    })();
  }, [contratoIdInicial, comissaoId]);

  function set(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return toast.error("Sem tenant");
    if (!form.contrato_id) return toast.error("Selecione o contrato");
    if (!form.corretor_id) return toast.error("Selecione o corretor");
    setSaving(true);
    const payload: any = {
      tenant_id: tenantId,
      contrato_id: form.contrato_id,
      corretor_id: form.corretor_id,
      percentual: form.percentual === "" ? null : Number(form.percentual),
      valor: Number(form.valor) || 0,
      status: form.status,
      data_prevista: form.data_prevista || null,
      data_pagamento: form.data_pagamento || null,
      observacoes: form.observacoes || null,
    };
    if (comissaoId) {
      const { error } = await supabase.from("comissoes").update(payload).eq("id", comissaoId);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      toast.success("Comissão atualizada");
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from("comissoes").insert(payload);
      if (error) {
        setSaving(false);
        // 23505 = índice único parcial comissoes(contrato_id) — já existe comissão pra esse contrato
        if (error.code === "23505") {
          return toast.error("Já existe uma comissão para este contrato");
        }
        return toast.error(error.message);
      }
      toast.success("Comissão criada");
    }
    setSaving(false);
    navigate({ to: "/app/comissoes" });
  }

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Vínculos</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Contrato *">
            <select
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.contrato_id}
              onChange={(e) => set("contrato_id", e.target.value)}
            >
              <option value="">Selecione…</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero ?? c.id.slice(0, 8)} ({c.tipo})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Corretor *">
            <select
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.corretor_id}
              onChange={(e) => set("corretor_id", e.target.value)}
            >
              <option value="">Selecione…</option>
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
        <h2 className="mb-4 text-base font-semibold">Valores e status</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Percentual (%)">
            <Input
              type="number"
              step="0.01"
              value={form.percentual}
              onChange={(e) => set("percentual", e.target.value)}
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
          <Field label="Data prevista">
            <Input
              type="date"
              value={form.data_prevista}
              onChange={(e) => set("data_prevista", e.target.value)}
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
        <h2 className="mb-4 text-base font-semibold">Observações</h2>
        <Textarea
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/comissoes" })}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : comissaoId ? "Salvar alterações" : "Criar comissão"}
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
