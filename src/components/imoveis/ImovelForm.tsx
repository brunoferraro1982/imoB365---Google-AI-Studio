import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FINALIDADE_LABEL, STATUS_LABEL, TIPO_LABEL, slugify } from "@/lib/format";
import { CheckCircle2, FileText, Globe } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AiImovelPanel } from "./AiImovelPanel";

export type ImovelFormData = {
  titulo: string;
  slug: string;
  codigo_interno: string;
  descricao: string;
  finalidade: string;
  tipo: string;
  status: string;
  preco: number;
  condominio: number | null;
  iptu: number | null;
  area_total: number | null;
  area_util: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  endereco_cep: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  mostrar_endereco_publico: boolean;
  aceita_financiamento: boolean;
  aceita_permuta: boolean;
  publicado: boolean;
  corretor_responsavel_id: string | null;
  custom_data: Record<string, any>;
};

export const emptyImovel: ImovelFormData = {
  titulo: "",
  slug: "",
  codigo_interno: "",
  descricao: "",
  finalidade: "venda",
  tipo: "apartamento",
  status: "rascunho",
  preco: 0,
  condominio: null,
  iptu: null,
  area_total: null,
  area_util: null,
  quartos: null,
  suites: null,
  banheiros: null,
  vagas: null,
  endereco_cep: "",
  endereco_logradouro: "",
  endereco_numero: "",
  endereco_complemento: "",
  endereco_bairro: "",
  endereco_cidade: "",
  endereco_uf: "",
  mostrar_endereco_publico: false,
  aceita_financiamento: false,
  aceita_permuta: false,
  publicado: false,
  corretor_responsavel_id: null,
  custom_data: {},
};

function num(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

export function ImovelForm({
  initial,
  onSubmit,
  submitLabel,
  submitting,
  mode = "create",
}: {
  initial?: Partial<ImovelFormData>;
  onSubmit: (data: ImovelFormData, action: "save" | "publish" | "unpublish") => Promise<void> | void;
  submitLabel: string;
  submitting?: boolean;
  mode?: "create" | "edit";
}) {
  const [data, setData] = useState<ImovelFormData>({ ...emptyImovel, ...initial });
  const [pendingAction, setPendingAction] = useState<"save" | "publish" | "unpublish" | null>(null);
  const [corretores, setCorretores] = useState<{ id: string; nome: string }[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: list } = await (supabase as any)
        .from("corretores")
        .select("id,nome")
        .eq("ativo", true)
        .order("nome");
      setCorretores((list as { id: string; nome: string }[]) ?? []);
      const { data: cf } = await (supabase as any)
        .from("tenant_custom_fields")
        .select("*")
        .eq("entidade", "imovel")
        .order("ordem").order("created_at");
      setCustomFields(cf ?? []);
    })();
  }, []);

  function update<K extends keyof ImovelFormData>(k: K, v: ImovelFormData[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function lookupCep(cep: string) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const json = await res.json();
      if (json.erro) return;
      setData((d) => ({
        ...d,
        endereco_logradouro: json.logradouro ?? d.endereco_logradouro,
        endereco_bairro: json.bairro ?? d.endereco_bairro,
        endereco_cidade: json.localidade ?? d.endereco_cidade,
        endereco_uf: json.uf ?? d.endereco_uf,
      }));
    } catch {/* silent */}
  }

  function submitWith(action: "save" | "publish" | "unpublish", e?: FormEvent) {
    e?.preventDefault();
    let payload: ImovelFormData = { ...data, slug: data.slug || slugify(data.titulo) };
    if (action === "publish") {
      payload = { ...payload, publicado: true, status: "ativo" };
      setData(payload);
    } else if (action === "unpublish") {
      payload = { ...payload, publicado: false, status: payload.status === "ativo" ? "inativo" : payload.status };
      setData(payload);
    }
    setPendingAction(action);
    onSubmit(payload, action);
  }

  const isPublished = data.publicado && data.status === "ativo";

  return (
    <form onSubmit={(e) => submitWith(mode === "create" ? "save" : "save", e)} className="space-y-8">
      <Section title="Informações principais">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título *">
            <Input required value={data.titulo} onChange={(e) => update("titulo", e.target.value)} />
          </Field>
          <Field label="Código interno">
            <Input value={data.codigo_interno} onChange={(e) => update("codigo_interno", e.target.value)} />
          </Field>
          <Field label="Finalidade">
            <Select value={data.finalidade} onValueChange={(v) => update("finalidade", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FINALIDADE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={data.tipo} onValueChange={(v) => update("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Descrição">
          <Textarea rows={5} value={data.descricao} onChange={(e) => update("descricao", e.target.value)} />
        </Field>
        <AiImovelPanel
          data={data}
          onApplyDescricao={(t) => update("descricao", t)}
          onApplyTitulo={(t) => update("titulo", t)}
        />
      </Section>

      <Section title="Valores e medidas">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Preço (R$) *">
            <Input type="number" step="0.01" required value={data.preco} onChange={(e) => update("preco", Number(e.target.value))} />
          </Field>
          <Field label="Condomínio (R$)">
            <Input type="number" step="0.01" value={data.condominio ?? ""} onChange={(e) => update("condominio", num(e.target.value))} />
          </Field>
          <Field label="IPTU (R$)">
            <Input type="number" step="0.01" value={data.iptu ?? ""} onChange={(e) => update("iptu", num(e.target.value))} />
          </Field>
          <Field label="Área total (m²)">
            <Input type="number" step="0.01" value={data.area_total ?? ""} onChange={(e) => update("area_total", num(e.target.value))} />
          </Field>
          <Field label="Área útil (m²)">
            <Input type="number" step="0.01" value={data.area_util ?? ""} onChange={(e) => update("area_util", num(e.target.value))} />
          </Field>
          <Field label="Quartos">
            <Input type="number" value={data.quartos ?? ""} onChange={(e) => update("quartos", num(e.target.value))} />
          </Field>
          <Field label="Suítes">
            <Input type="number" value={data.suites ?? ""} onChange={(e) => update("suites", num(e.target.value))} />
          </Field>
          <Field label="Banheiros">
            <Input type="number" value={data.banheiros ?? ""} onChange={(e) => update("banheiros", num(e.target.value))} />
          </Field>
          <Field label="Vagas">
            <Input type="number" value={data.vagas ?? ""} onChange={(e) => update("vagas", num(e.target.value))} />
          </Field>
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid gap-4 md:grid-cols-6">
          <Field label="CEP" className="md:col-span-2">
            <Input
              value={data.endereco_cep}
              onChange={(e) => update("endereco_cep", e.target.value)}
              onBlur={(e) => lookupCep(e.target.value)}
              placeholder="00000-000"
            />
          </Field>
          <Field label="Logradouro" className="md:col-span-4">
            <Input value={data.endereco_logradouro} onChange={(e) => update("endereco_logradouro", e.target.value)} />
          </Field>
          <Field label="Número" className="md:col-span-1">
            <Input value={data.endereco_numero} onChange={(e) => update("endereco_numero", e.target.value)} />
          </Field>
          <Field label="Complemento" className="md:col-span-2">
            <Input value={data.endereco_complemento} onChange={(e) => update("endereco_complemento", e.target.value)} />
          </Field>
          <Field label="Bairro" className="md:col-span-3">
            <Input value={data.endereco_bairro} onChange={(e) => update("endereco_bairro", e.target.value)} />
          </Field>
          <Field label="Cidade" className="md:col-span-4">
            <Input value={data.endereco_cidade} onChange={(e) => update("endereco_cidade", e.target.value)} />
          </Field>
          <Field label="UF" className="md:col-span-2">
            <Input maxLength={2} value={data.endereco_uf} onChange={(e) => update("endereco_uf", e.target.value.toUpperCase())} />
          </Field>
        </div>
        <Toggle
          label="Mostrar endereço completo na página pública"
          checked={data.mostrar_endereco_publico}
          onChange={(v) => update("mostrar_endereco_publico", v)}
        />
      </Section>

      <Section title="Condições">
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle label="Aceita financiamento" checked={data.aceita_financiamento} onChange={(v) => update("aceita_financiamento", v)} />
          <Toggle label="Aceita permuta" checked={data.aceita_permuta} onChange={(v) => update("aceita_permuta", v)} />
        </div>
      </Section>

      <Section title="Corretor responsável">
        <Field label="Corretor">
          <Select
            value={data.corretor_responsavel_id ?? "__none__"}
            onValueChange={(v) => update("corretor_responsavel_id", v === "__none__" ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="Sem corretor responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem corretor responsável</SelectItem>
              {corretores.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {corretores.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhum corretor cadastrado ainda. Cadastre em <span className="font-medium">Corretores</span> para vincular.
            </p>
          )}
        </Field>
      </Section>

      {customFields.length > 0 && (
        <Section title="Campos personalizados">
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => {
              const val = data.custom_data?.[f.chave];
              const setVal = (v: any) =>
                update("custom_data", { ...(data.custom_data ?? {}), [f.chave]: v });
              return (
                <Field key={f.id} label={f.rotulo + (f.obrigatorio ? " *" : "")}>
                  {f.tipo === "boolean" ? (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                      <span className="text-sm">Sim</span>
                      <Switch checked={!!val} onCheckedChange={setVal} />
                    </div>
                  ) : f.tipo === "select" ? (
                    <Select value={val ?? ""} onValueChange={setVal}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {(f.opcoes ?? []).map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={f.tipo === "numero" ? "number" : f.tipo === "data" ? "date" : "text"}
                      value={val ?? ""}
                      onChange={(e) => setVal(e.target.value)}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Situação do imóvel">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${isPublished ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
            {isPublished ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {isPublished ? "Publicado no site público" : "Rascunho — não aparece no site"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPublished
                ? "Visível para visitantes em /buscar e na página do imóvel."
                : "Conclua o preenchimento e clique em Publicar para tornar visível."}
            </p>
          </div>
        </div>
        <Field label="Status comercial (avançado)">
          <Select value={data.status} onValueChange={(v) => update("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Use para marcar como vendido, alugado ou reservado. Imóveis publicados precisam estar com status "Ativo".
          </p>
        </Field>
      </Section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => submitWith("save")}
        >
          {submitting && pendingAction === "save" ? "Salvando…" : mode === "create" ? "Salvar rascunho" : "Salvar alterações"}
        </Button>
        {isPublished ? (
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => submitWith("unpublish")}
          >
            {submitting && pendingAction === "unpublish" ? "Despublicando…" : "Despublicar"}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={submitting}
            onClick={() => submitWith("publish")}
          >
            <Globe className="mr-2 h-4 w-4" />
            {submitting && pendingAction === "publish" ? "Publicando…" : "Publicar imóvel"}
          </Button>
        )}
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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}