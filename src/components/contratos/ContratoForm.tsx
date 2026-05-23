import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = { contratoId?: string };

const TIPOS = ["venda", "locacao", "permuta", "outro"] as const;
const STATUSES = ["rascunho", "ativo", "encerrado", "cancelado"] as const;

export function ContratoForm({ contratoId }: Props) {
  const { tenantId, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({
    numero: "", tipo: "venda", status: "rascunho", valor: 0,
    comissao_percentual: "", comissao_valor: "",
    data_inicio: "", data_fim: "", observacoes: "",
    imovel_id: "", lead_id: "", corretor_id: "",
  });
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [corretores, setCorretores] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!contratoId);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [{ data: i }, { data: l }, { data: c }] = await Promise.all([
        supabase.from("imoveis").select("id,titulo,codigo_interno").eq("tenant_id", tenantId).order("titulo"),
        supabase.from("leads").select("id,nome").eq("tenant_id", tenantId).order("nome"),
        supabase.from("corretores").select("id,nome").eq("tenant_id", tenantId).eq("ativo", true).order("nome"),
      ]);
      setImoveis(i ?? []); setLeads(l ?? []); setCorretores(c ?? []);
    })();
  }, [tenantId]);

  useEffect(() => {
    if (!contratoId) return;
    (async () => {
      const { data } = await supabase.from("contratos").select("*").eq("id", contratoId).maybeSingle();
      if (data) setForm({
        ...data,
        imovel_id: data.imovel_id ?? "", lead_id: data.lead_id ?? "", corretor_id: data.corretor_id ?? "",
        numero: data.numero ?? "", data_inicio: data.data_inicio ?? "", data_fim: data.data_fim ?? "",
        observacoes: data.observacoes ?? "",
        comissao_percentual: data.comissao_percentual ?? "", comissao_valor: data.comissao_valor ?? "",
      });
      setLoading(false);
    })();
  }, [contratoId]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return toast.error("Sem tenant");
    setSaving(true);
    const payload: any = {
      tenant_id: tenantId,
      numero: form.numero || null,
      tipo: form.tipo,
      status: form.status,
      valor: Number(form.valor) || 0,
      comissao_percentual: form.comissao_percentual === "" ? null : Number(form.comissao_percentual),
      comissao_valor: form.comissao_valor === "" ? null : Number(form.comissao_valor),
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      observacoes: form.observacoes || null,
      imovel_id: form.imovel_id || null,
      lead_id: form.lead_id || null,
      corretor_id: form.corretor_id || null,
    };
    if (contratoId) {
      const { error } = await supabase.from("contratos").update(payload).eq("id", contratoId);
      if (error) { setSaving(false); return toast.error(error.message); }
      toast.success("Contrato atualizado");
    } else {
      payload.created_by = user?.id;
      const { data, error } = await supabase.from("contratos").insert(payload).select("id").single();
      if (error) { setSaving(false); return toast.error(error.message); }
      toast.success("Contrato criado");
      navigate({ to: "/app/contratos/$id", params: { id: data.id } });
      return;
    }
    setSaving(false);
  }

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <form onSubmit={save} className="max-w-4xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Dados gerais</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Número"><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} maxLength={60} /></Field>
          <Field label="Tipo">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Valor (R$)"><Input type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", e.target.value)} /></Field>
          <Field label="Comissão (%)"><Input type="number" step="0.01" value={form.comissao_percentual} onChange={(e) => set("comissao_percentual", e.target.value)} /></Field>
          <Field label="Comissão (R$)"><Input type="number" step="0.01" value={form.comissao_valor} onChange={(e) => set("comissao_valor", e.target.value)} /></Field>
          <Field label="Data início"><Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} /></Field>
          <Field label="Data fim"><Input type="date" value={form.data_fim} onChange={(e) => set("data_fim", e.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Vínculos</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Imóvel">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.imovel_id} onChange={(e) => set("imovel_id", e.target.value)}>
              <option value="">—</option>
              {imoveis.map((i) => <option key={i.id} value={i.id}>{i.codigo_interno ? `[${i.codigo_interno}] ` : ""}{i.titulo}</option>)}
            </select>
          </Field>
          <Field label="Lead">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.lead_id} onChange={(e) => set("lead_id", e.target.value)}>
              <option value="">—</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </Field>
          <Field label="Corretor">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.corretor_id} onChange={(e) => set("corretor_id", e.target.value)}>
              <option value="">—</option>
              {corretores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Observações</h2>
        <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={4} maxLength={4000} />
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/contratos" })}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : contratoId ? "Salvar alterações" : "Criar contrato"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}