import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Landmark, Trash2 } from "lucide-react";

type Integracao = {
  id: string;
  provider: string;
  nome_exibicao: string;
  config: Record<string, string>;
  ativo: boolean;
};

const PROVIDERS = [
  { value: "bb", label: "Banco do Brasil" },
  { value: "itau", label: "Itaú" },
  { value: "bradesco", label: "Bradesco" },
  { value: "santander", label: "Santander" },
  { value: "nubank", label: "Nubank" },
  { value: "caixa", label: "Caixa" },
  { value: "outro", label: "Outro" },
];
const PROVIDER_LABEL = Object.fromEntries(PROVIDERS.map((p) => [p.value, p.label]));

const emptyForm = { provider: PROVIDERS[0].value, nome: "", agencia: "", conta: "", ativo: false };

// Cadastro administrativo de conciliação bancária (Financeiro Fase 4) —
// lista + formulário sempre visível na própria página (sem modal), mesmo
// padrão de ParcelasSection.tsx. Escrita direta do client (RLS admin) —
// sem chamada real a API de banco ainda (exige um agregador certificado de
// Open Finance, ex. Pluggy — decisão de produto pendente, ver backlog).
//
// A metade de "Integrações ERP" que existia aqui (Conta Azul/Omie) foi
// removida — investigação estratégica confirmou que essas plataformas
// competem diretamente com o próprio Financeiro do imob365 (contas a
// pagar/receber, fluxo de caixa, DRE, centros de custo, cobrança via
// PIX/boleto/cartão já são nativos aqui), então "integrar" só mandaria o
// tenant sincronizar dado pra um concorrente em vez de manter o valor no
// imob365. O único gap real identificado (emissão de Nota Fiscal
// Eletrônica) vira uma integração própria, não uma ponte pra ERP de
// terceiro.
export function ConciliacaoBancariaSection() {
  const { tenantId, user } = useAuth();
  const [items, setItems] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("tenant_integracoes_financeiras")
      .select("id,provider,nome_exibicao,config,ativo")
      .eq("tenant_id", tenantId)
      .eq("tipo", "conciliacao_bancaria")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Integracao[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function set(k: keyof typeof emptyForm, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function iniciarEdicao(i: Integracao) {
    setEditingId(i.id);
    setForm({
      provider: i.provider,
      nome: i.nome_exibicao,
      agencia: i.config?.agencia ?? "",
      conta: i.config?.conta ?? "",
      ativo: i.ativo,
    });
  }
  function cancelarEdicao() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return toast.error("Sem tenant");
    if (!form.nome.trim()) return toast.error("Informe um nome de exibição");
    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      tipo: "conciliacao_bancaria",
      provider: form.provider,
      nome_exibicao: form.nome.trim(),
      config: { agencia: form.agencia, conta: form.conta },
      ativo: form.ativo,
    };

    const { error } = editingId
      ? await (supabase as any)
          .from("tenant_integracoes_financeiras")
          .update(payload)
          .eq("id", editingId)
      : await (supabase as any)
          .from("tenant_integracoes_financeiras")
          .insert({ ...payload, created_by: user?.id });

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Integração atualizada" : "Integração adicionada");
    cancelarEdicao();
    load();
  }

  async function remover(id: string) {
    const { error } = await (supabase as any)
      .from("tenant_integracoes_financeiras")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Integração removida");
    if (editingId === id) cancelarEdicao();
    load();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Cadastradas</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma integração cadastrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {items.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-center gap-3">
                  <Landmark className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{i.nome_exibicao}</p>
                    <p className="text-xs text-muted-foreground">
                      {PROVIDER_LABEL[i.provider] ?? i.provider}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {i.ativo ? <Badge>Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => iniciarEdicao(i)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remover(i.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={salvar} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">
          {editingId ? "Editar integração" : "Nova integração"}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Banco">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.provider}
              onChange={(e) => set("provider", e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nome de exibição">
            <Input
              required
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="ex.: Conta corrente principal"
              maxLength={120}
            />
          </Field>
          <Field label="Agência">
            <Input value={form.agencia} onChange={(e) => set("agencia", e.target.value)} />
          </Field>
          <Field label="Conta">
            <Input value={form.conta} onChange={(e) => set("conta", e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
          <Label htmlFor="integracao-ativa" className="text-sm">
            Ativa
          </Label>
          <Switch
            id="integracao-ativa"
            checked={form.ativo}
            onCheckedChange={(v) => set("ativo", v)}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Este cadastro só guarda os dados de conexão — nenhuma sincronização real é feita ainda.
        </p>

        <div className="flex justify-end gap-2">
          {editingId && (
            <Button type="button" variant="outline" onClick={cancelarEdicao}>
              Cancelar edição
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Adicionar"}
          </Button>
        </div>
      </form>
    </div>
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
