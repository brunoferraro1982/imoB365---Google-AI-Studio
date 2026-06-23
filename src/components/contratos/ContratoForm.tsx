import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ContratoTipo = Database["public"]["Enums"]["contrato_tipo"];
type ContratoStatus = Database["public"]["Enums"]["contrato_status"];

type Props = { contratoId?: string };

export const TIPOS_CONTRATO = [
  { value: "venda", label: "Venda" },
  { value: "locacao", label: "Locação" },
  { value: "permuta", label: "Permuta" },
  { value: "parceria", label: "Parceria" },
  { value: "administracao", label: "Administração" },
  { value: "prestacao_servico", label: "Prestação de Serviço" },
  { value: "outro", label: "Outro" },
] as const;

export const STATUS_CONTRATO = [
  { value: "rascunho", label: "Rascunho" },
  { value: "ativo", label: "Ativo" },
  { value: "encerrado", label: "Encerrado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

type Template = { id: string; nome: string; tipo: string };

export function ContratoForm({ contratoId }: Props) {
  const { tenantId, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<{
    numero: string;
    tipo: string;
    status: string;
    valor: number | string;
    comissao_percentual: number | string;
    comissao_valor: number | string;
    data_inicio: string;
    data_fim: string;
    observacoes: string;
    imovel_id: string;
    lead_id: string;
    corretor_id: string;
    template_id: string;
  }>({
    numero: "",
    tipo: "venda",
    status: "rascunho",
    valor: 0,
    comissao_percentual: "",
    comissao_valor: "",
    data_inicio: "",
    data_fim: "",
    observacoes: "",
    imovel_id: "",
    lead_id: "",
    corretor_id: "",
    template_id: "",
  });

  const [imoveis, setImoveis] = useState<Array<{ id: string; titulo: string; codigo_interno: string | null }>>([]);
  const [leads, setLeads] = useState<Array<{ id: string; nome: string }>>([]);
  const [corretores, setCorretores] = useState<Array<{ id: string; nome: string }>>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!contratoId);

  // Load relational data
  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [{ data: i }, { data: l }, { data: c }, { data: tpl }] = await Promise.all([
        supabase
          .from("imoveis")
          .select("id,titulo,codigo_interno")
          .eq("tenant_id", tenantId)
          .order("titulo"),
        supabase.from("leads").select("id,nome").eq("tenant_id", tenantId).order("nome"),
        supabase
          .from("corretores")
          .select("id,nome")
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("contrato_templates")
          .select("id,nome,tipo")
          .eq("ativo", true)
          .order("nome"),
      ]);
      setImoveis(i ?? []);
      setLeads(l ?? []);
      setCorretores(c ?? []);
      setTemplates((tpl ?? []) as Template[]);
    })();
  }, [tenantId]);

  // Load existing contrato for edit
  useEffect(() => {
    if (!contratoId) return;
    (async () => {
      const { data } = await supabase
        .from("contratos")
        .select("*")
        .eq("id", contratoId)
        .maybeSingle();
      if (data) {
        setForm({
          numero: data.numero ?? "",
          tipo: data.tipo ?? "venda",
          status: data.status ?? "rascunho",
          valor: data.valor ?? 0,
          comissao_percentual: data.comissao_percentual ?? "",
          comissao_valor: data.comissao_valor ?? "",
          data_inicio: data.data_inicio ?? "",
          data_fim: data.data_fim ?? "",
          observacoes: data.observacoes ?? "",
          imovel_id: data.imovel_id ?? "",
          lead_id: data.lead_id ?? "",
          corretor_id: data.corretor_id ?? "",
          template_id: "",
        });
      }
      setLoading(false);
    })();
  }, [contratoId]);

  function set(k: string, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function applyChecklistTemplate(contratoId: string) {
    if (!form.template_id || !tenantId) return;
    const { data: tplItens } = await supabase
      .from("checklist_template_itens")
      .select("*")
      .eq("template_id", form.template_id)
      .order("ordem");
    if (!tplItens?.length) return;
    const rows = (tplItens as Array<{
      etapa: string; titulo: string; obrigatorio: boolean; ordem: number;
    }>).map((i) => ({
      tenant_id: tenantId,
      contrato_id: contratoId,
      etapa: i.etapa,
      titulo: i.titulo,
      obrigatorio: i.obrigatorio,
      ordem: i.ordem,
    }));
    await supabase.from("contrato_checklist").insert(rows as any);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return toast.error("Sem tenant");
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      numero: form.numero || null,
      tipo: form.tipo as ContratoTipo,
      status: form.status as ContratoStatus,
      valor: Number(form.valor) || 0,
      comissao_percentual:
        form.comissao_percentual === "" ? null : Number(form.comissao_percentual),
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
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Contrato atualizado");
    } else {
      const { data, error } = await supabase
        .from("contratos")
        .insert({ ...payload, created_by: user?.id })
        .select("id")
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      // Auto-apply checklist template if selected
      if (form.template_id) {
        await applyChecklistTemplate(data.id);
      }
      toast.success("Contrato criado" + (form.template_id ? " com checklist aplicado" : ""));
      navigate({ to: "/app/contratos/$id", params: { id: data.id } });
      return;
    }
    setSaving(false);
  }

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <form onSubmit={save} className="max-w-4xl space-y-6">
      {/* Dados gerais */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Dados gerais</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Número">
            <Input
              value={form.numero}
              onChange={(e) => set("numero", e.target.value)}
              maxLength={60}
              placeholder="Ex.: CONT-2024-001"
            />
          </Field>

          <Field label="Tipo">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.tipo}
              onChange={(e) => set("tipo", e.target.value)}
            >
              {TIPOS_CONTRATO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
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
              {STATUS_CONTRATO.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Valor (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.valor}
              onChange={(e) => set("valor", e.target.value)}
            />
          </Field>

          <Field label="Comissão (%)">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.comissao_percentual}
              onChange={(e) => set("comissao_percentual", e.target.value)}
              placeholder="Ex.: 6"
            />
          </Field>

          <Field label="Comissão (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.comissao_valor}
              onChange={(e) => set("comissao_valor", e.target.value)}
            />
          </Field>

          <Field label="Data início">
            <Input
              type="date"
              value={form.data_inicio}
              onChange={(e) => set("data_inicio", e.target.value)}
            />
          </Field>

          <Field label="Data fim / vencimento">
            <Input
              type="date"
              value={form.data_fim}
              onChange={(e) => set("data_fim", e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* Vínculos */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Vínculos</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Imóvel">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.imovel_id}
              onChange={(e) => set("imovel_id", e.target.value)}
            >
              <option value="">— Nenhum —</option>
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.codigo_interno ? `[${i.codigo_interno}] ` : ""}
                  {i.titulo}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Lead / Cliente">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.lead_id}
              onChange={(e) => set("lead_id", e.target.value)}
            >
              <option value="">— Nenhum —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Corretor responsável">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.corretor_id}
              onChange={(e) => set("corretor_id", e.target.value)}
            >
              <option value="">— Nenhum —</option>
              {corretores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Template de checklist (só na criação) */}
      {!contratoId && (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-base font-semibold">Checklist de documentos</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Selecione um template para gerar automaticamente o checklist ao criar o contrato.
          </p>
          <Field label="Template de checklist">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.template_id}
              onChange={(e) => set("template_id", e.target.value)}
            >
              <option value="">— Não aplicar —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} ({TIPOS_CONTRATO.find((x) => x.value === t.tipo)?.label ?? t.tipo})
                </option>
              ))}
            </select>
          </Field>
          {templates.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Nenhum template ativo.{" "}
              <a href="/app/contratos/modelos" className="underline">
                Criar templates
              </a>
              .
            </p>
          )}
        </section>
      )}

      {/* Observações */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Observações internas</h2>
        <Textarea
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Notas, cláusulas especiais, condições…"
        />
      </section>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/app/contratos" })}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : contratoId ? "Salvar alterações" : "Criar contrato"}
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
