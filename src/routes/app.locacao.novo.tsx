import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { actionGuard } from "@/lib/routeGuard";

export const Route = createFileRoute("/app/locacao/novo")({
  beforeLoad: actionGuard("imobiliario", "write"),
  component: NovoLocacao,
});

// Colunas de locação que ainda não estão em types.ts (a migração é aplicada
// pelo dono em separado). Estende o Insert gerado; passar a variável tipada
// dispensa cast no insert.
type ContratoInsertGerado = Database["public"]["Tables"]["contratos"]["Insert"];
type ContratoParteInsert = Database["public"]["Tables"]["contrato_partes"]["Insert"];
export type ContratoInsertLocacao = ContratoInsertGerado & {
  taxa_administracao_percentual?: number;
  indice_reajuste?: string;
};

const INDICES_REAJUSTE = ["IPCA", "IGP-M", "INPC"] as const;
type IndiceReajuste = (typeof INDICES_REAJUSTE)[number];

const STEPS = ["Imóvel", "Partes", "Valores", "Resumo"] as const;

// ---------- Validação (Zod) ----------

const parteSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo").max(200),
  documento: z.string().trim().min(11, "Informe o CPF ou CNPJ").max(18, "Documento inválido"),
  email: z.string().trim().email("E-mail inválido").max(200),
  telefone: z.string().trim().min(8, "Informe o telefone").max(30),
});

const stepImovelSchema = z.object({
  imovel_id: z.string().uuid("Selecione um imóvel"),
});

const stepPartesSchema = z.object({
  locador: parteSchema,
  locatario: parteSchema,
});

const stepValoresSchema = z.object({
  aluguel: z
    .number({ invalid_type_error: "Informe o valor do aluguel" })
    .positive("O aluguel deve ser maior que zero")
    .max(100_000_000, "Valor acima do limite"),
  dia_vencimento: z
    .number({ invalid_type_error: "Informe o dia de vencimento" })
    .int()
    .min(1, "Dia de vencimento entre 1 e 28")
    .max(28, "Dia de vencimento entre 1 e 28"),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de início"),
  prazo_meses: z
    .number({ invalid_type_error: "Informe o prazo em meses" })
    .int()
    .min(1, "Prazo mínimo de 1 mês")
    .max(360, "Prazo máximo de 360 meses"),
  renovacao_automatica: z.boolean(),
  taxa_administracao_percentual: z
    .number({ invalid_type_error: "Taxa inválida" })
    .min(0, "A taxa não pode ser negativa")
    .max(100, "A taxa não pode passar de 100%")
    .optional(),
  indice_reajuste: z.enum(INDICES_REAJUSTE),
  observacoes: z.string().trim().max(2000, "Máximo de 2000 caracteres").optional(),
});

const schemaPorEtapa = [stepImovelSchema, stepPartesSchema, stepValoresSchema] as const;
const schemaCompleto = stepImovelSchema.merge(stepPartesSchema).merge(stepValoresSchema);

// ---------- Estado do formulário ----------

type ParteForm = { nome: string; documento: string; email: string; telefone: string };

type LocacaoForm = {
  imovel_id: string;
  locador: ParteForm;
  locatario: ParteForm;
  aluguel: number;
  dia_vencimento: string;
  data_inicio: string;
  prazo_meses: string;
  renovacao_automatica: boolean;
  taxa_administracao_percentual: string;
  indice_reajuste: IndiceReajuste;
  observacoes: string;
};

const parteVazia = (): ParteForm => ({ nome: "", documento: "", email: "", telefone: "" });

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function estadoInicial(): LocacaoForm {
  return {
    imovel_id: "",
    locador: parteVazia(),
    locatario: parteVazia(),
    aluguel: 0,
    dia_vencimento: "10",
    data_inicio: hojeISO(),
    prazo_meses: "30",
    renovacao_automatica: true,
    taxa_administracao_percentual: "",
    indice_reajuste: "IPCA",
    observacoes: "",
  };
}

// Converte o estado de texto em valores tipados para validação.
function paraEntrada(f: LocacaoForm) {
  const taxa = f.taxa_administracao_percentual.trim();
  return {
    imovel_id: f.imovel_id,
    locador: f.locador,
    locatario: f.locatario,
    aluguel: f.aluguel,
    dia_vencimento: Number(f.dia_vencimento),
    data_inicio: f.data_inicio,
    prazo_meses: Number(f.prazo_meses),
    renovacao_automatica: f.renovacao_automatica,
    taxa_administracao_percentual: taxa === "" ? undefined : Number(taxa.replace(",", ".")),
    indice_reajuste: f.indice_reajuste,
    observacoes: f.observacoes,
  };
}

// Término do contrato: último dia antes do aniversário do início.
function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + meses, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type ImovelOpcao = {
  id: string;
  titulo: string;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  preco: number;
};

// ---------- Componente ----------

function NovoLocacao() {
  const { user, tenantId } = useAuth();
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(0);
  const [form, setForm] = useState<LocacaoForm>(estadoInicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [imoveis, setImoveis] = useState<ImovelOpcao[]>([]);
  const [carregandoImoveis, setCarregandoImoveis] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setCarregandoImoveis(true);
    supabase
      .from("imoveis")
      .select("id,titulo,endereco_logradouro,endereco_numero,endereco_bairro,endereco_cidade,preco")
      .eq("tenant_id", tenantId)
      .eq("publicado", true)
      .eq("finalidade", "aluguel")
      .eq("status", "ativo")
      .order("titulo")
      .then(({ data, error }) => {
        if (error) toast.error("Erro ao carregar imóveis: " + error.message);
        setImoveis((data as ImovelOpcao[] | null) ?? []);
        setCarregandoImoveis(false);
      });
  }, [tenantId]);

  function set<K extends keyof LocacaoForm>(key: K, value: LocacaoForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setParte(papel: "locador" | "locatario", key: keyof ParteForm, value: string) {
    setForm((f) => ({ ...f, [papel]: { ...f[papel], [key]: value } }));
  }

  // Valida só a etapa atual; mostra erros por campo.
  function validarEtapa(indice: number): boolean {
    const entrada = paraEntrada(form);
    const r = schemaPorEtapa[indice].safeParse(entrada);
    if (r.success) {
      setErros({});
      return true;
    }
    const mapa: Record<string, string> = {};
    for (const issue of r.error.issues) {
      const chave = issue.path.join(".");
      if (!mapa[chave]) mapa[chave] = issue.message;
    }
    setErros(mapa);
    toast.error(r.error.issues[0]?.message ?? "Verifique os campos");
    return false;
  }

  function proximo() {
    if (!validarEtapa(etapa)) return;
    setErros({});
    setEtapa((e) => Math.min(e + 1, STEPS.length - 1));
  }

  function voltar() {
    setErros({});
    setEtapa((e) => Math.max(e - 1, 0));
  }

  const imovelSelecionado = imoveis.find((i) => i.id === form.imovel_id);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!tenantId || !user) return toast.error("Sessão inválida. Entre novamente.");

    // Revalida o formulário inteiro antes de gravar.
    const entrada = paraEntrada(form);
    const r = schemaCompleto.safeParse(entrada);
    if (!r.success) {
      const primeiro = r.error.issues[0];
      const idxEtapa =
        primeiro.path[0] === "imovel_id"
          ? 0
          : primeiro.path[0] === "locador" || primeiro.path[0] === "locatario"
            ? 1
            : 2;
      setEtapa(idxEtapa);
      validarEtapa(idxEtapa);
      return;
    }
    const v = r.data;

    setSaving(true);
    const contratoPayload: ContratoInsertLocacao = {
      tenant_id: tenantId,
      tipo: "locacao",
      status: "rascunho",
      imovel_id: v.imovel_id,
      valor: v.aluguel,
      dia_vencimento: v.dia_vencimento,
      data_inicio: v.data_inicio,
      data_fim: somarMeses(v.data_inicio, v.prazo_meses),
      numero_parcelas: v.prazo_meses,
      renovacao_automatica: v.renovacao_automatica,
      observacoes: v.observacoes ? v.observacoes : null,
      taxa_administracao_percentual: v.taxa_administracao_percentual,
      indice_reajuste: v.indice_reajuste,
      created_by: user.id,
    };

    const { data: contrato, error } = await supabase
      .from("contratos")
      // Cast restrito: o insert gerado rejeita as colunas de locação ainda ausentes em types.ts.
      .insert(contratoPayload as ContratoInsertGerado)
      .select("id")
      .single();
    if (error || !contrato) {
      setSaving(false);
      return toast.error(error?.message ?? "Erro ao criar locação");
    }

    const partes: ContratoParteInsert[] = [
      { papel: "locador", ...v.locador },
      { papel: "locatario", ...v.locatario },
    ].map((p) => ({
      tenant_id: tenantId,
      contrato_id: contrato.id,
      papel: p.papel as ContratoParteInsert["papel"],
      nome: p.nome,
      documento: p.documento,
      email: p.email,
      telefone: p.telefone,
    }));

    const { error: errPartes } = await supabase.from("contrato_partes").insert(partes);
    setSaving(false);
    if (errPartes) {
      // Sem as partes a locação fica incompleta: desfaz o contrato recém-criado.
      await supabase.from("contratos").delete().eq("id", contrato.id);
      return toast.error("Não foi possível salvar as partes: " + errPartes.message);
    }

    toast.success("Locação cadastrada");
    navigate({ to: "/app/locacao" });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/app/locacao">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>
      </Button>

      <header>
        <h1 className="text-2xl font-bold">Nova locação</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre a locação aqui. O Jurídico usa estes dados para gerar o contrato.
        </p>
      </header>

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((nome, i) => (
          <li
            key={nome}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
              i === etapa ? "border-primary font-semibold text-primary" : "text-muted-foreground"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
              {i < etapa ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            {nome}
          </li>
        ))}
      </ol>

      <form onSubmit={confirmar} className="space-y-6 rounded-xl border bg-card p-6">
        {etapa === 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">1. Imóvel</h2>
            <p className="text-xs text-muted-foreground">
              Somente imóveis publicados, para aluguel e disponíveis do seu tenant.
            </p>
            {carregandoImoveis ? (
              <p className="text-sm text-muted-foreground">Carregando imóveis…</p>
            ) : imoveis.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum imóvel disponível para locação. Publique um imóvel com finalidade aluguel em
                Imóveis.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {imoveis.map((im) => {
                  const ativo = im.id === form.imovel_id;
                  const endereco = [
                    im.endereco_logradouro,
                    im.endereco_numero,
                    im.endereco_bairro,
                    im.endereco_cidade,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <button
                      key={im.id}
                      type="button"
                      onClick={() => set("imovel_id", im.id)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        ativo ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-medium">{im.titulo}</div>
                      <div className="text-xs text-muted-foreground">{endereco || "—"}</div>
                    </button>
                  );
                })}
              </div>
            )}
            {erros["imovel_id"] && <p className="text-xs text-destructive">{erros["imovel_id"]}</p>}
          </section>
        )}

        {etapa === 1 && (
          <section className="grid gap-6 md:grid-cols-2">
            <ParteCampos
              titulo="2. Locador (proprietário)"
              valor={form.locador}
              erros={erros}
              prefixo="locador"
              onChange={(k, v) => setParte("locador", k, v)}
            />
            <ParteCampos
              titulo="Locatário (inquilino)"
              valor={form.locatario}
              erros={erros}
              prefixo="locatario"
              onChange={(k, v) => setParte("locatario", k, v)}
            />
          </section>
        )}

        {etapa === 2 && (
          <section className="grid gap-4 md:grid-cols-2">
            <h2 className="text-base font-semibold md:col-span-2">3. Valores e condições</h2>

            <Campo label="Aluguel mensal (R$)" erro={erros["aluguel"]}>
              <CurrencyInput value={form.aluguel} onValueChange={(v) => set("aluguel", v)} />
            </Campo>

            <Campo label="Dia de vencimento (1 a 28)" erro={erros["dia_vencimento"]}>
              <Input
                type="number"
                min={1}
                max={28}
                value={form.dia_vencimento}
                onChange={(e) => set("dia_vencimento", e.target.value)}
              />
            </Campo>

            <Campo label="Data de início" erro={erros["data_inicio"]}>
              <Input
                type="date"
                value={form.data_inicio}
                onChange={(e) => set("data_inicio", e.target.value)}
              />
            </Campo>

            <Campo label="Prazo (meses)" erro={erros["prazo_meses"]}>
              <Input
                type="number"
                min={1}
                max={360}
                value={form.prazo_meses}
                onChange={(e) => set("prazo_meses", e.target.value)}
              />
            </Campo>

            <Campo
              label="Taxa de administração (%) desta locação"
              erro={erros["taxa_administracao_percentual"]}
            >
              <Input
                inputMode="decimal"
                placeholder="Ex.: 10"
                value={form.taxa_administracao_percentual}
                onChange={(e) => set("taxa_administracao_percentual", e.target.value)}
              />
            </Campo>

            <Campo label="Índice de reajuste" erro={erros["indice_reajuste"]}>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.indice_reajuste}
                onChange={(e) => set("indice_reajuste", e.target.value as IndiceReajuste)}
              >
                {INDICES_REAJUSTE.map((i) => (
                  <option key={i} value={i}>
                    {i === "IPCA" ? "IPCA (padrão)" : i}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
              <div>
                <Label htmlFor="renovacao">Renovação automática</Label>
                <p className="text-xs text-muted-foreground">
                  O contrato renova ao fim do prazo, salvo aviso em contrário.
                </p>
              </div>
              <Switch
                id="renovacao"
                checked={form.renovacao_automatica}
                onCheckedChange={(v) => set("renovacao_automatica", v)}
              />
            </div>

            <Campo label="Observações" erro={erros["observacoes"]} className="md:col-span-2">
              <Textarea
                rows={3}
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
              />
            </Campo>
          </section>
        )}

        {etapa === 3 && (
          <section className="space-y-4 text-sm">
            <h2 className="text-base font-semibold">4. Resumo</h2>
            <dl className="grid gap-3 md:grid-cols-2">
              <Resumo label="Imóvel" valor={imovelSelecionado?.titulo ?? "—"} />
              <Resumo label="Aluguel mensal" valor={formatBRL(form.aluguel)} />
              <Resumo label="Locador" valor={`${form.locador.nome} · ${form.locador.documento}`} />
              <Resumo
                label="Locatário"
                valor={`${form.locatario.nome} · ${form.locatario.documento}`}
              />
              <Resumo label="Vencimento" valor={`Dia ${form.dia_vencimento}`} />
              <Resumo label="Início" valor={form.data_inicio} />
              <Resumo
                label="Prazo"
                valor={`${form.prazo_meses} meses (até ${somarMeses(form.data_inicio, Number(form.prazo_meses) || 0)})`}
              />
              <Resumo
                label="Renovação automática"
                valor={form.renovacao_automatica ? "Sim" : "Não"}
              />
              <Resumo
                label="Taxa de administração"
                valor={
                  form.taxa_administracao_percentual
                    ? `${form.taxa_administracao_percentual}%`
                    : "Não informada"
                }
              />
              <Resumo label="Reajuste" valor={form.indice_reajuste} />
            </dl>
            <p className="text-xs text-muted-foreground">
              A locação será salva como rascunho, pronta para o Jurídico gerar o contrato.
            </p>
          </section>
        )}

        <footer className="flex items-center justify-between border-t pt-4">
          <Button type="button" variant="outline" onClick={voltar} disabled={etapa === 0 || saving}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          {etapa < STEPS.length - 1 ? (
            <Button type="button" onClick={proximo}>
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Confirmar locação"}
            </Button>
          )}
        </footer>
      </form>
    </div>
  );
}

function Campo({
  label,
  erro,
  className,
  children,
}: {
  label: string;
  erro?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

function ParteCampos({
  titulo,
  valor,
  erros,
  prefixo,
  onChange,
}: {
  titulo: string;
  valor: ParteForm;
  erros: Record<string, string>;
  prefixo: string;
  onChange: (k: keyof ParteForm, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <Campo label="Nome completo" erro={erros[`${prefixo}.nome`]}>
        <Input value={valor.nome} onChange={(e) => onChange("nome", e.target.value)} />
      </Campo>
      <Campo label="CPF / CNPJ" erro={erros[`${prefixo}.documento`]}>
        <Input value={valor.documento} onChange={(e) => onChange("documento", e.target.value)} />
      </Campo>
      <Campo label="E-mail" erro={erros[`${prefixo}.email`]}>
        <Input
          type="email"
          value={valor.email}
          onChange={(e) => onChange("email", e.target.value)}
        />
      </Campo>
      <Campo label="Telefone" erro={erros[`${prefixo}.telefone`]}>
        <Input value={valor.telefone} onChange={(e) => onChange("telefone", e.target.value)} />
      </Campo>
    </div>
  );
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-md border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
