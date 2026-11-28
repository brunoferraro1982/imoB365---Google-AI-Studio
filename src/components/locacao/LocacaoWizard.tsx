import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { isValidCPF, slugify, TIPO_LABEL } from "@/lib/format";

// Colunas que ainda não estão em types.ts (a migração é aplicada pelo dono em
// separado). Estende o Insert/Update gerados; o cast restrito fica só nos pontos de gravação.
type ContratoInsertGerado = Database["public"]["Tables"]["contratos"]["Insert"];
type ContratoUpdateGerado = Database["public"]["Tables"]["contratos"]["Update"];
type ContratoParteInsert = Database["public"]["Tables"]["contrato_partes"]["Insert"];
type ContratoLinha = Database["public"]["Tables"]["contratos"]["Row"];
type ParteLinha = Database["public"]["Tables"]["contrato_partes"]["Row"];
type ImovelInsertGerado = Database["public"]["Tables"]["imoveis"]["Insert"];

export type TaxaAdicional = { descricao: string; valor: number };

export type ContratoInsertLocacao = ContratoInsertGerado & {
  taxa_administracao_percentual?: number | null;
  indice_reajuste?: string;
  taxas_adicionais?: TaxaAdicional[];
};
export type ContratoUpdateLocacao = ContratoUpdateGerado & {
  taxa_administracao_percentual?: number | null;
  indice_reajuste?: string;
  taxas_adicionais?: TaxaAdicional[];
};

// data_nascimento e creci: colunas da migração do PR #432.
export type ParteInsertCompleta = ContratoParteInsert & {
  data_nascimento?: string | null;
  creci?: string | null;
};
type ParteDados = Omit<ParteInsertCompleta, "tenant_id" | "contrato_id" | "papel">;

const INDICES_REAJUSTE = ["IPCA", "IGP-M", "INPC"] as const;
type IndiceReajuste = (typeof INDICES_REAJUSTE)[number];

const ESTADOS_CIVIS = [
  "solteiro(a)",
  "casado(a)",
  "divorciado(a)",
  "viúvo(a)",
  "união estável",
] as const;

const TIPOS_IMOVEL = [
  "apartamento",
  "casa",
  "casa_condominio",
  "sobrado",
  "cobertura",
  "flat",
  "kitnet",
  "terreno",
  "sitio",
  "chacara",
  "fazenda",
  "comercial_sala",
  "comercial_loja",
  "comercial_galpao",
  "comercial_predio",
  "outro",
] as const;

const NACIONALIDADE_PADRAO = "brasileiro(a)";
const LIMITE_VALOR = 100_000_000;
const MAX_TAXAS = 20;

const STEPS = ["Imóvel", "Partes", "Valores", "Resumo"] as const;

// ---------- Valores monetários (formato brasileiro) ----------
// Enquanto se digita: "1500" mostra 1.500 e "1500,5" mostra 1.500,5 (valor 1500.5).
// Ao sair do campo completa os centavos: 1.500,00 e 1.500,50.
// "." é aceito como decimal só quando vier logo antes de 1 ou 2 dígitos no fim
// (ex.: "1500.50"); em "1.500" é separador de milhar.

function normalizarDigitacaoMoeda(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s.includes(",")) {
    const m = s.match(/\.(\d{0,2})$/);
    if (m && m.index !== undefined) s = `${s.slice(0, m.index)},${m[1]}`;
  }
  const temVirgula = s.includes(",");
  const [parteInt = "", ...resto] = s.split(",");
  const inteiro = parteInt.replace(/\./g, "").replace(/^0+(?=\d)/, "");
  const decimal = resto.join("").replace(/[.,]/g, "").slice(0, 2);
  const inteiroFormatado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (!temVirgula) return inteiroFormatado;
  return `${inteiroFormatado || "0"},${decimal}`;
}

// Converte o texto digitado em número. Vazio vira undefined.
function parseMoedaInput(texto: string): number | undefined {
  const t = texto.trim();
  if (t === "") return undefined;
  const [inteiro = "", decimal = ""] = t.split(",");
  const n = Number(`${inteiro.replace(/\./g, "") || "0"}.${decimal || "0"}`);
  return Number.isFinite(n) ? n : undefined;
}

function formatMoedaInput(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Ao sair do campo: completa os centavos (1500 vira 1.500,00) ou vazio se não houver valor.
function completarMoeda(texto: string): string {
  const n = parseMoedaInput(texto);
  return n === undefined ? "" : formatMoedaInput(n);
}

function CampoMoeda({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        inputMode="decimal"
        className="pl-9"
        placeholder={placeholder ?? "0,00"}
        value={value}
        onChange={(e) => onChange(normalizarDigitacaoMoeda(e.target.value))}
        onBlur={() => onChange(completarMoeda(value))}
      />
    </div>
  );
}

// ---------- Validação (Zod) ----------

function isValidCNPJ(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (tamanho: number) => {
    const pesos =
      tamanho === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const documentoSchema = z
  .string()
  .trim()
  .refine((v) => {
    const d = v.replace(/\D/g, "");
    return d.length === 11 ? isValidCPF(d) : d.length === 14 ? isValidCNPJ(d) : false;
  }, "Informe um CPF ou CNPJ válido");

const dataNascimentoSchema = z
  .string()
  .refine(
    (v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v < hojeISO()),
    "A data de nascimento deve ser anterior a hoje",
  );

const parteBaseSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo").max(200),
  nacionalidade: z.string().trim().max(60),
  estado_civil: z
    .string()
    .refine(
      (v) => v === "" || (ESTADOS_CIVIS as readonly string[]).includes(v),
      "Estado civil inválido",
    ),
  profissao: z.string().trim().max(120),
  documento: documentoSchema,
  rg: z.string().trim().max(30),
  rg_orgao: z.string().trim().max(30),
  data_nascimento: dataNascimentoSchema,
  endereco: z.string().trim().max(300),
  email: z.string().trim().email("E-mail inválido").max(200),
  telefone: z.string().trim().min(8, "Informe o telefone").max(30),
});

const procuradorSchema = z.object({
  nome: z.string().trim().max(200),
  documento: z.string().trim(),
  rg: z.string().trim().max(30),
  rg_orgao: z.string().trim().max(30),
  creci: z.string().trim().max(30),
});

const locadorSchema = parteBaseSchema
  .extend({ representado: z.boolean(), procurador: procuradorSchema })
  .superRefine((v, ctx) => {
    if (!v.representado) return;
    if (v.procurador.nome.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["procurador", "nome"],
        message: "Informe o nome completo do procurador",
      });
    }
    if (!isValidCPF(v.procurador.documento)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["procurador", "documento"],
        message: "Informe um CPF válido para o procurador",
      });
    }
    if (v.procurador.creci.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["procurador", "creci"],
        message: "Informe o CRECI do procurador",
      });
    }
  });

const locatarioSchema = parteBaseSchema.extend({
  conjuge_nome: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || v.length >= 3, "Informe o nome completo do cônjuge"),
});

const numeroOpcionalSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,2}$/.test(v), "Informe um número inteiro");

const novoImovelSchema = z.object({
  tipo: z.enum(TIPOS_IMOVEL, { errorMap: () => ({ message: "Selecione o tipo do imóvel" }) }),
  logradouro: z.string().trim().min(3, "Informe o logradouro").max(200),
  numero: z.string().trim().min(1, "Informe o número").max(20),
  complemento: z.string().trim().max(100),
  bairro: z.string().trim().min(2, "Informe o bairro").max(100),
  cidade: z.string().trim().min(2, "Informe a cidade").max(100),
  uf: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "UF com 2 letras"),
  cep: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{5}-?\d{3}$/.test(v), "CEP inválido"),
  quartos: numeroOpcionalSchema,
  banheiros: numeroOpcionalSchema,
  sala: z.boolean(),
  cozinha: z.boolean(),
  quintal: z.boolean(),
  area_servico: z.boolean(),
  outras: z.string().trim().max(300),
});

const stepImovelSchema = z.discriminatedUnion("modo", [
  z.object({ modo: z.literal("existente"), imovel_id: z.string().uuid("Selecione um imóvel") }),
  z.object({ modo: z.literal("novo"), novo_imovel: novoImovelSchema }),
]);

const stepPartesSchema = z.object({
  locador: locadorSchema,
  locatario: locatarioSchema,
});

const valorMoedaOpcionalSchema = z
  .number({ invalid_type_error: "Valor inválido" })
  .min(0, "O valor não pode ser negativo")
  .max(LIMITE_VALOR, "Valor acima do limite")
  .optional();

const taxaAdicionalSchema = z.object({
  descricao: z
    .string()
    .min(2, "Informe a descrição da taxa")
    .max(100, "Descrição com no máximo 100 caracteres"),
  valor: z
    .number({
      required_error: "Informe o valor da taxa",
      invalid_type_error: "Informe o valor da taxa",
    })
    .positive("O valor da taxa deve ser maior que zero")
    .max(LIMITE_VALOR, "Valor acima do limite"),
});

const stepValoresSchema = z.object({
  aluguel: z
    .number({
      required_error: "Informe o valor do aluguel",
      invalid_type_error: "Informe o valor do aluguel",
    })
    .positive("O aluguel deve ser maior que zero")
    .max(LIMITE_VALOR, "Valor acima do limite"),
  valor_iptu: valorMoedaOpcionalSchema,
  valor_condominio: valorMoedaOpcionalSchema,
  valor_seguro: valorMoedaOpcionalSchema,
  taxas: z.array(taxaAdicionalSchema).max(MAX_TAXAS, `Máximo de ${MAX_TAXAS} taxas`),
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

const schemasPorEtapa = [stepImovelSchema, stepPartesSchema, stepValoresSchema] as const;

// ---------- Estado do formulário ----------

type ParteBaseForm = {
  nome: string;
  nacionalidade: string;
  estado_civil: string;
  profissao: string;
  documento: string;
  rg: string;
  rg_orgao: string;
  data_nascimento: string;
  endereco: string;
  email: string;
  telefone: string;
};

type ProcuradorForm = {
  nome: string;
  documento: string;
  rg: string;
  rg_orgao: string;
  creci: string;
};

type LocadorForm = ParteBaseForm & { representado: boolean; procurador: ProcuradorForm };

type LocatarioForm = ParteBaseForm & { conjuge_nome: string };

type NovoImovelForm = {
  tipo: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  quartos: string;
  banheiros: string;
  sala: boolean;
  cozinha: boolean;
  quintal: boolean;
  area_servico: boolean;
  outras: string;
};

// Valores monetários ficam como texto digitado ("1.500,50"); viram número só ao validar/salvar.
type TaxaForm = { id: string; descricao: string; valor: string };

type LocacaoForm = {
  imovel_modo: "existente" | "novo";
  imovel_id: string;
  novo_imovel: NovoImovelForm;
  locador: LocadorForm;
  locatario: LocatarioForm;
  aluguel: string;
  valor_iptu: string;
  valor_condominio: string;
  valor_seguro: string;
  taxas: TaxaForm[];
  dia_vencimento: string;
  data_inicio: string;
  prazo_meses: string;
  renovacao_automatica: boolean;
  taxa_administracao_percentual: string;
  indice_reajuste: IndiceReajuste;
  observacoes: string;
};

// Ids das partes já gravadas (modo edição). Ausente = ainda não existe no banco.
type IdsPartes = { locador?: string; procurador?: string; locatario?: string };

const parteBaseVazia = (): ParteBaseForm => ({
  nome: "",
  nacionalidade: NACIONALIDADE_PADRAO,
  estado_civil: "",
  profissao: "",
  documento: "",
  rg: "",
  rg_orgao: "",
  data_nascimento: "",
  endereco: "",
  email: "",
  telefone: "",
});

const procuradorVazio = (): ProcuradorForm => ({
  nome: "",
  documento: "",
  rg: "",
  rg_orgao: "",
  creci: "",
});

const novoImovelVazio = (): NovoImovelForm => ({
  tipo: "casa",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  quartos: "",
  banheiros: "",
  sala: false,
  cozinha: false,
  quintal: false,
  area_servico: false,
  outras: "",
});

let sequenciaTaxa = 0;
function novaTaxaVazia(): TaxaForm {
  sequenciaTaxa += 1;
  return { id: `taxa-${sequenciaTaxa}`, descricao: "", valor: "" };
}

function estadoInicial(): LocacaoForm {
  return {
    imovel_modo: "existente",
    imovel_id: "",
    novo_imovel: novoImovelVazio(),
    locador: { ...parteBaseVazia(), representado: false, procurador: procuradorVazio() },
    locatario: { ...parteBaseVazia(), conjuge_nome: "" },
    aluguel: "",
    valor_iptu: "",
    valor_condominio: "",
    valor_seguro: "",
    taxas: [],
    dia_vencimento: "10",
    data_inicio: hojeISO(),
    prazo_meses: "30",
    renovacao_automatica: true,
    taxa_administracao_percentual: "",
    indice_reajuste: "IPCA",
    observacoes: "",
  };
}

// Só taxas com alguma informação entram na validação e no total.
function taxasPreenchidas(f: LocacaoForm): TaxaForm[] {
  return f.taxas.filter((t) => t.descricao.trim() !== "" || t.valor.trim() !== "");
}

// Converte o estado de texto em valores tipados para validação.
function paraEntrada(f: LocacaoForm) {
  const taxa = f.taxa_administracao_percentual.trim();
  return {
    modo: f.imovel_modo,
    imovel_id: f.imovel_id,
    novo_imovel: f.novo_imovel,
    locador: f.locador,
    locatario: f.locatario,
    aluguel: parseMoedaInput(f.aluguel),
    valor_iptu: parseMoedaInput(f.valor_iptu),
    valor_condominio: parseMoedaInput(f.valor_condominio),
    valor_seguro: parseMoedaInput(f.valor_seguro),
    taxas: taxasPreenchidas(f).map((t) => ({
      descricao: t.descricao.trim(),
      valor: parseMoedaInput(t.valor),
    })),
    dia_vencimento: Number(f.dia_vencimento),
    data_inicio: f.data_inicio,
    prazo_meses: Number(f.prazo_meses),
    renovacao_automatica: f.renovacao_automatica,
    taxa_administracao_percentual: taxa === "" ? undefined : Number(taxa.replace(",", ".")),
    indice_reajuste: f.indice_reajuste,
    observacoes: f.observacoes,
  };
}

// Totais mensais exibidos no Resumo (aluguel + IPTU + condomínio + seguro + outras taxas).
function valoresMensais(f: LocacaoForm) {
  const num = (s: string) => parseMoedaInput(s) ?? 0;
  const taxas = taxasPreenchidas(f).map((t) => ({
    descricao: t.descricao.trim(),
    valor: num(t.valor),
  }));
  const aluguel = num(f.aluguel);
  const iptu = num(f.valor_iptu);
  const condominio = num(f.valor_condominio);
  const seguro = num(f.valor_seguro);
  const somaTaxas = taxas.reduce((acc, t) => acc + t.valor, 0);
  const total = Math.round((aluguel + iptu + condominio + seguro + somaTaxas) * 100) / 100;
  return { aluguel, iptu, condominio, seguro, taxas, total };
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

function formatData(iso: string): string {
  return iso ? iso.split("-").reverse().join("/") : "";
}

// RG é gravado no campo único rg como "número órgão".
function rgComposto(numero: string, orgao: string): string | null {
  return (
    [numero, orgao]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ") || null
  );
}

// Inverso de rgComposto: separa o último trecho como órgão expedidor.
function rgSeparado(rg: string | null): { rg: string; rg_orgao: string } {
  const t = (rg ?? "").trim();
  const i = t.lastIndexOf(" ");
  if (i === -1) return { rg: t, rg_orgao: "" };
  return { rg: t.slice(0, i), rg_orgao: t.slice(i + 1) };
}

function caracteristicasDe(n: NovoImovelForm): string[] {
  const marcadas = [
    n.sala ? "Sala" : null,
    n.cozinha ? "Cozinha" : null,
    n.quintal ? "Quintal" : null,
    n.area_servico ? "Área de serviço" : null,
  ].filter((x): x is string => x !== null);
  const outras = n.outras
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...marcadas, ...outras];
}

function dadosParte(p: ParteBaseForm): ParteDados {
  return {
    nome: p.nome,
    nacionalidade: p.nacionalidade || null,
    estado_civil: p.estado_civil || null,
    profissao: p.profissao || null,
    documento: p.documento,
    rg: rgComposto(p.rg, p.rg_orgao),
    data_nascimento: p.data_nascimento || null,
    endereco: p.endereco || null,
    email: p.email,
    telefone: p.telefone,
  };
}

function dadosProcurador(p: ProcuradorForm): ParteDados {
  return {
    nome: p.nome,
    documento: p.documento,
    rg: rgComposto(p.rg, p.rg_orgao),
    creci: p.creci,
    responsabilidade: "representa o locador",
  };
}

function dadosLocatario(l: LocatarioForm): ParteDados {
  return {
    ...dadosParte(l),
    conjuge: l.conjuge_nome ? { nome: l.conjuge_nome } : null,
  };
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

// Reconstrói o formulário a partir do contrato e das partes gravadas (modo edição).
function formularioDeContrato(
  c: ContratoLinha,
  partes: ParteLinha[],
): { form: LocacaoForm; ids: IdsPartes } {
  const ids: IdsPartes = {};
  const vazia = estadoInicial();

  const locadorRow = partes.find((p) => p.papel === "locador");
  const procuradorRow = partes.find((p) => p.papel === "procurador");
  const locatarioRow = partes.find((p) => p.papel === "locatario");
  if (locadorRow) ids.locador = locadorRow.id;
  if (procuradorRow) ids.procurador = procuradorRow.id;
  if (locatarioRow) ids.locatario = locatarioRow.id;

  const parteDe = (p: ParteLinha | undefined): ParteBaseForm => {
    if (!p) return parteBaseVazia();
    const rg = rgSeparado(p.rg);
    return {
      nome: p.nome,
      nacionalidade: p.nacionalidade ?? "",
      estado_civil: p.estado_civil ?? "",
      profissao: p.profissao ?? "",
      documento: p.documento ?? "",
      rg: rg.rg,
      rg_orgao: rg.rg_orgao,
      data_nascimento: p.data_nascimento ?? "",
      endereco: p.endereco ?? "",
      email: p.email ?? "",
      telefone: p.telefone ?? "",
    };
  };

  const procRg = rgSeparado(procuradorRow?.rg ?? null);
  const conjuge = locatarioRow?.conjuge as { nome?: unknown } | null | undefined;
  const taxasBrutas = (c as ContratoLinha & { taxas_adicionais?: unknown }).taxas_adicionais;
  const taxas: TaxaForm[] = Array.isArray(taxasBrutas)
    ? taxasBrutas
        .filter((t): t is { descricao: string; valor: number } => {
          const x = t as { descricao?: unknown; valor?: unknown };
          return typeof x?.descricao === "string" && typeof x?.valor === "number";
        })
        .map((t) => ({
          ...novaTaxaVazia(),
          descricao: t.descricao,
          valor: formatMoedaInput(t.valor),
        }))
    : [];

  const form: LocacaoForm = {
    ...vazia,
    imovel_modo: "existente",
    imovel_id: c.imovel_id ?? "",
    locador: {
      ...parteDe(locadorRow),
      representado: Boolean(procuradorRow),
      procurador: procuradorRow
        ? {
            nome: procuradorRow.nome,
            documento: procuradorRow.documento ?? "",
            rg: procRg.rg,
            rg_orgao: procRg.rg_orgao,
            creci: procuradorRow.creci ?? "",
          }
        : procuradorVazio(),
    },
    locatario: {
      ...parteDe(locatarioRow),
      conjuge_nome: typeof conjuge?.nome === "string" ? conjuge.nome : "",
    },
    aluguel: formatMoedaInput(c.valor),
    valor_iptu: formatMoedaInput(c.valor_iptu),
    valor_condominio: formatMoedaInput(c.valor_condominio),
    valor_seguro: formatMoedaInput(c.valor_seguro),
    taxas,
    dia_vencimento: String(c.dia_vencimento ?? 10),
    data_inicio: c.data_inicio ?? hojeISO(),
    prazo_meses: c.numero_parcelas != null ? String(c.numero_parcelas) : "",
    renovacao_automatica: c.renovacao_automatica,
    taxa_administracao_percentual:
      c.taxa_administracao_percentual != null
        ? String(c.taxa_administracao_percentual).replace(".", ",")
        : "",
    indice_reajuste: (INDICES_REAJUSTE as readonly string[]).includes(c.indice_reajuste)
      ? (c.indice_reajuste as IndiceReajuste)
      : "IPCA",
    observacoes: c.observacoes ?? "",
  };
  return { form, ids };
}

// Grava as partes de uma locação já existente: atualiza as linhas atuais, insere as que faltam
// e remove o procurador quando o locador deixa de ser representado. Não duplica partes.
async function sincronizarPartes(
  contratoId: string,
  tenantId: string,
  ids: IdsPartes,
  locador: LocadorForm,
  locatario: LocatarioForm,
): Promise<string | null> {
  const operacoes: {
    papel: "locador" | "procurador" | "locatario";
    id?: string;
    dados: ParteDados | null;
  }[] = [
    { papel: "locador", id: ids.locador, dados: dadosParte(locador) },
    {
      papel: "procurador",
      id: ids.procurador,
      dados: locador.representado ? dadosProcurador(locador.procurador) : null,
    },
    { papel: "locatario", id: ids.locatario, dados: dadosLocatario(locatario) },
  ];

  for (const op of operacoes) {
    if (!op.dados) {
      if (op.id) {
        const { error } = await supabase
          .from("contrato_partes")
          .delete()
          .eq("id", op.id)
          .eq("tenant_id", tenantId);
        if (error) return error.message;
      }
      continue;
    }
    if (op.id) {
      const { error } = await supabase
        .from("contrato_partes")
        .update(op.dados)
        .eq("id", op.id)
        .eq("tenant_id", tenantId);
      if (error) return error.message;
    } else {
      const { error } = await supabase
        .from("contrato_partes")
        .insert([
          { tenant_id: tenantId, contrato_id: contratoId, papel: op.papel, ...op.dados },
        ] as ContratoParteInsert[]);
      if (error) return error.message;
    }
  }
  return null;
}

// ---------- Componente público ----------

export type LocacaoWizardProps = { modo: "novo" } | { modo: "editar"; contratoId: string };

export function LocacaoWizard(props: LocacaoWizardProps) {
  if (props.modo === "novo") {
    return <FormularioLocacao modo="novo" inicial={estadoInicial()} ids={{}} imovelAtual={null} />;
  }
  return <CarregarLocacao contratoId={props.contratoId} />;
}

// Busca o contrato e as partes para o modo edição; só então monta o formulário.
function CarregarLocacao({ contratoId }: { contratoId: string }) {
  const { tenantId } = useAuth();
  const [estado, setEstado] = useState<
    | { status: "carregando" }
    | { status: "erro"; mensagem: string }
    | {
        status: "ok";
        form: LocacaoForm;
        ids: IdsPartes;
        imovelAtual: ImovelOpcao | null;
        contratoId: string;
      }
  >({ status: "carregando" });

  useEffect(() => {
    if (!tenantId) return;
    let ativo = true;
    (async () => {
      const { data: contrato, error } = await supabase
        .from("contratos")
        .select("*")
        .eq("id", contratoId)
        .eq("tenant_id", tenantId)
        .eq("tipo", "locacao")
        .maybeSingle();
      if (!ativo) return;
      if (error || !contrato) {
        setEstado({ status: "erro", mensagem: error?.message ?? "Locação não encontrada" });
        return;
      }
      const { data: partes, error: errPartes } = await supabase
        .from("contrato_partes")
        .select("*")
        .eq("contrato_id", contratoId)
        .eq("tenant_id", tenantId);
      if (!ativo) return;
      if (errPartes) {
        setEstado({ status: "erro", mensagem: errPartes.message });
        return;
      }
      let imovelAtual: ImovelOpcao | null = null;
      if (contrato.imovel_id) {
        const { data: imovel } = await supabase
          .from("imoveis")
          .select(
            "id,titulo,endereco_logradouro,endereco_numero,endereco_bairro,endereco_cidade,preco",
          )
          .eq("id", contrato.imovel_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        imovelAtual = (imovel as ImovelOpcao | null) ?? null;
      }
      if (!ativo) return;
      const { form, ids } = formularioDeContrato(contrato, (partes ?? []) as ParteLinha[]);
      setEstado({ status: "ok", form, ids, imovelAtual, contratoId });
    })();
    return () => {
      ativo = false;
    };
  }, [contratoId, tenantId]);

  if (estado.status === "carregando") {
    return <p className="p-8 text-sm text-muted-foreground">Carregando locação…</p>;
  }
  if (estado.status === "erro") {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-8">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/locacao">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <p className="text-sm text-destructive">
          Não foi possível carregar a locação: {estado.mensagem}
        </p>
      </div>
    );
  }
  return (
    <FormularioLocacao
      modo="editar"
      contratoId={estado.contratoId}
      inicial={estado.form}
      ids={estado.ids}
      imovelAtual={estado.imovelAtual}
    />
  );
}

// ---------- Formulário (wizard) ----------

type FormularioProps =
  | { modo: "novo"; inicial: LocacaoForm; ids: IdsPartes; imovelAtual: ImovelOpcao | null }
  | {
      modo: "editar";
      contratoId: string;
      inicial: LocacaoForm;
      ids: IdsPartes;
      imovelAtual: ImovelOpcao | null;
    };

function FormularioLocacao(props: FormularioProps) {
  const { modo, inicial, ids, imovelAtual } = props;
  const { user, tenantId } = useAuth();
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(0);
  const [form, setForm] = useState<LocacaoForm>(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [imoveis, setImoveis] = useState<ImovelOpcao[]>(imovelAtual ? [imovelAtual] : []);
  const [carregandoImoveis, setCarregandoImoveis] = useState(true);
  const [saving, setSaving] = useState(false);
  const editando = modo === "editar";

  useEffect(() => {
    if (!tenantId) return;
    setCarregandoImoveis(true);
    supabase
      .from("imoveis")
      .select("id,titulo,endereco_logradouro,endereco_numero,endereco_bairro,endereco_cidade,preco")
      .eq("tenant_id", tenantId)
      .eq("finalidade", "aluguel")
      .eq("status", "ativo")
      .order("titulo")
      .then(({ data, error }) => {
        if (error) toast.error("Erro ao carregar imóveis: " + error.message);
        const lista = (data as ImovelOpcao[] | null) ?? [];
        // Na edição, o imóvel já vinculado aparece mesmo que não esteja mais ativo para locação.
        const incluir = imovelAtual && !lista.some((i) => i.id === imovelAtual.id);
        setImoveis(incluir ? [imovelAtual, ...lista] : lista);
        setCarregandoImoveis(false);
      });
  }, [tenantId, imovelAtual]);

  function set<K extends keyof LocacaoForm>(key: K, value: LocacaoForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setNovoImovel<K extends keyof NovoImovelForm>(key: K, value: NovoImovelForm[K]) {
    setForm((f) => ({ ...f, novo_imovel: { ...f.novo_imovel, [key]: value } }));
  }

  function setLocador(key: keyof ParteBaseForm, value: string) {
    setForm((f) => ({ ...f, locador: { ...f.locador, [key]: value } }));
  }

  function setProcurador(key: keyof ProcuradorForm, value: string) {
    setForm((f) => ({
      ...f,
      locador: { ...f.locador, procurador: { ...f.locador.procurador, [key]: value } },
    }));
  }

  function setLocatario(key: keyof LocatarioForm, value: string) {
    setForm((f) => ({ ...f, locatario: { ...f.locatario, [key]: value } }));
  }

  function alterarTaxa(id: string, campo: "descricao" | "valor", valor: string) {
    const novoValor = campo === "valor" ? normalizarDigitacaoMoeda(valor) : valor;
    setForm((f) => ({
      ...f,
      taxas: f.taxas.map((t) => (t.id === id ? { ...t, [campo]: novoValor } : t)),
    }));
  }

  function removerTaxa(id: string) {
    setForm((f) => ({ ...f, taxas: f.taxas.filter((t) => t.id !== id) }));
  }

  function adicionarTaxa() {
    setForm((f) => ({ ...f, taxas: [...f.taxas, novaTaxaVazia()] }));
  }

  // Valida só a etapa atual; mostra erros por campo.
  function validarEtapa(indice: number): boolean {
    const entrada = paraEntrada(form);
    const r = schemasPorEtapa[indice].safeParse(entrada);
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
    const rImovel = stepImovelSchema.safeParse(entrada);
    const rPartes = stepPartesSchema.safeParse(entrada);
    const rValores = stepValoresSchema.safeParse(entrada);
    if (!rImovel.success || !rPartes.success || !rValores.success) {
      const idx = !rImovel.success ? 0 : !rPartes.success ? 1 : 2;
      setEtapa(idx);
      validarEtapa(idx);
      return;
    }
    const v = rValores.data;
    const { locador, locatario } = rPartes.data;

    setSaving(true);

    // Imóvel novo é gravado primeiro; se o contrato falhar, ele é removido.
    let imovelCriadoId: string | null = null;
    let imovelId: string;
    if (rImovel.data.modo === "novo") {
      const n = rImovel.data.novo_imovel;
      const titulo = `${TIPO_LABEL[n.tipo]} – ${n.logradouro}, ${n.numero} – ${n.bairro}`;
      const imovelPayload: ImovelInsertGerado = {
        tenant_id: tenantId,
        created_by: user.id,
        titulo,
        slug: `${slugify(titulo)}-${Date.now().toString(36)}`,
        tipo: n.tipo,
        finalidade: "aluguel",
        status: "ativo",
        publicado: false,
        endereco_logradouro: n.logradouro,
        endereco_numero: n.numero,
        endereco_complemento: n.complemento || null,
        endereco_bairro: n.bairro,
        endereco_cidade: n.cidade,
        endereco_uf: n.uf.toUpperCase(),
        endereco_cep: n.cep || null,
        quartos: n.quartos === "" ? null : Number(n.quartos),
        banheiros: n.banheiros === "" ? null : Number(n.banheiros),
        caracteristicas: caracteristicasDe(n),
      };
      const { data: imovelNovo, error: errImovel } = await supabase
        .from("imoveis")
        .insert(imovelPayload)
        .select("id")
        .single();
      if (errImovel || !imovelNovo) {
        setSaving(false);
        return toast.error("Não foi possível cadastrar o imóvel: " + (errImovel?.message ?? ""));
      }
      imovelCriadoId = imovelNovo.id;
      imovelId = imovelNovo.id;
    } else {
      imovelId = rImovel.data.imovel_id;
    }

    const desfazerImovel = async () => {
      if (imovelCriadoId) await supabase.from("imoveis").delete().eq("id", imovelCriadoId);
    };

    // Campos do contrato comuns ao cadastro e à edição.
    const camposContrato = {
      valor: v.aluguel,
      valor_iptu: v.valor_iptu ?? null,
      valor_condominio: v.valor_condominio ?? null,
      valor_seguro: v.valor_seguro ?? null,
      taxas_adicionais: v.taxas,
      dia_vencimento: v.dia_vencimento,
      data_inicio: v.data_inicio,
      data_fim: somarMeses(v.data_inicio, v.prazo_meses),
      numero_parcelas: v.prazo_meses,
      renovacao_automatica: v.renovacao_automatica,
      observacoes: v.observacoes ? v.observacoes : null,
      taxa_administracao_percentual: v.taxa_administracao_percentual ?? null,
      indice_reajuste: v.indice_reajuste,
    };

    if (modo === "novo") {
      const contratoPayload: ContratoInsertLocacao = {
        ...camposContrato,
        tenant_id: tenantId,
        tipo: "locacao",
        status: "rascunho",
        imovel_id: imovelId,
        created_by: user.id,
      };

      const { data: contrato, error } = await supabase
        .from("contratos")
        // Cast restrito: o insert gerado rejeita as colunas de locação ainda ausentes em types.ts.
        .insert(contratoPayload as ContratoInsertGerado)
        .select("id")
        .single();
      if (error || !contrato) {
        await desfazerImovel();
        setSaving(false);
        return toast.error(error?.message ?? "Erro ao criar locação");
      }

      const base = { tenant_id: tenantId, contrato_id: contrato.id };
      const partes: ParteInsertCompleta[] = [
        { ...base, papel: "locador", ...dadosParte(locador) },
        ...(locador.representado
          ? [{ ...base, papel: "procurador" as const, ...dadosProcurador(locador.procurador) }]
          : []),
        { ...base, papel: "locatario", ...dadosLocatario(locatario) },
      ];

      const { error: errPartes } = await supabase
        .from("contrato_partes")
        // Cast restrito: data_nascimento e creci ainda não estão em types.ts.
        .insert(partes as ContratoParteInsert[]);
      if (errPartes) {
        // Sem as partes a locação fica incompleta: desfaz o contrato e o imóvel recém-criado.
        await supabase.from("contratos").delete().eq("id", contrato.id);
        await desfazerImovel();
        setSaving(false);
        return toast.error("Não foi possível salvar as partes: " + errPartes.message);
      }

      setSaving(false);
      toast.success("Locação cadastrada");
      navigate({ to: "/app/locacao" });
      return;
    }

    // Edição: atualiza o contrato existente e sincroniza as partes.
    const contratoUpdate: ContratoUpdateLocacao = { ...camposContrato, imovel_id: imovelId };
    const { error: errContrato } = await supabase
      .from("contratos")
      // Cast restrito: colunas de locação ainda ausentes em types.ts.
      .update(contratoUpdate as ContratoUpdateGerado)
      .eq("id", props.contratoId)
      .eq("tenant_id", tenantId);
    if (errContrato) {
      await desfazerImovel();
      setSaving(false);
      return toast.error("Não foi possível salvar a locação: " + errContrato.message);
    }

    const erroPartes = await sincronizarPartes(props.contratoId, tenantId, ids, locador, locatario);
    if (erroPartes) {
      setSaving(false);
      return toast.error(
        "A locação foi atualizada, mas não foi possível salvar as partes: " + erroPartes,
      );
    }

    setSaving(false);
    toast.success("Locação atualizada");
    navigate({ to: "/app/locacao" });
  }

  const novo = form.novo_imovel;
  const tituloNovo = `${TIPO_LABEL[novo.tipo] ?? ""} – ${novo.logradouro}, ${novo.numero} – ${novo.bairro}`;
  const mensais = valoresMensais(form);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/app/locacao">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>
      </Button>

      <header>
        <h1 className="text-2xl font-bold">{editando ? "Editar locação" : "Nova locação"}</h1>
        <p className="text-sm text-muted-foreground">
          {editando
            ? "Altere os dados da locação. O Jurídico usa estes dados para gerar o contrato."
            : "Cadastre a locação aqui. O Jurídico usa estes dados para gerar o contrato."}
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
          <section className="space-y-4">
            <h2 className="text-base font-semibold">1. Imóvel</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.imovel_modo === "existente" ? "default" : "outline"}
                aria-pressed={form.imovel_modo === "existente"}
                onClick={() => set("imovel_modo", "existente")}
              >
                Imóvel já cadastrado
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.imovel_modo === "novo" ? "default" : "outline"}
                aria-pressed={form.imovel_modo === "novo"}
                onClick={() => set("imovel_modo", "novo")}
              >
                Cadastrar novo imóvel
              </Button>
            </div>

            {form.imovel_modo === "existente" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Imóveis do seu tenant com finalidade aluguel e status ativo.
                </p>
                {carregandoImoveis ? (
                  <p className="text-sm text-muted-foreground">Carregando imóveis…</p>
                ) : imoveis.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum imóvel disponível para locação. Cadastre um novo imóvel acima ou ajuste
                    em Imóveis.
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
                {erros["imovel_id"] && (
                  <p className="text-xs text-destructive">{erros["imovel_id"]}</p>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Campo label="Tipo" erro={erros["novo_imovel.tipo"]}>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={novo.tipo}
                    onChange={(e) => setNovoImovel("tipo", e.target.value)}
                  >
                    {TIPOS_IMOVEL.map((t) => (
                      <option key={t} value={t}>
                        {TIPO_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Logradouro" erro={erros["novo_imovel.logradouro"]}>
                  <Input
                    value={novo.logradouro}
                    onChange={(e) => setNovoImovel("logradouro", e.target.value)}
                  />
                </Campo>
                <Campo label="Número" erro={erros["novo_imovel.numero"]}>
                  <Input
                    value={novo.numero}
                    onChange={(e) => setNovoImovel("numero", e.target.value)}
                  />
                </Campo>
                <Campo label="Complemento" erro={erros["novo_imovel.complemento"]}>
                  <Input
                    value={novo.complemento}
                    onChange={(e) => setNovoImovel("complemento", e.target.value)}
                  />
                </Campo>
                <Campo label="Bairro" erro={erros["novo_imovel.bairro"]}>
                  <Input
                    value={novo.bairro}
                    onChange={(e) => setNovoImovel("bairro", e.target.value)}
                  />
                </Campo>
                <Campo label="Cidade" erro={erros["novo_imovel.cidade"]}>
                  <Input
                    value={novo.cidade}
                    onChange={(e) => setNovoImovel("cidade", e.target.value)}
                  />
                </Campo>
                <Campo label="UF" erro={erros["novo_imovel.uf"]}>
                  <Input
                    maxLength={2}
                    placeholder="SP"
                    value={novo.uf}
                    onChange={(e) => setNovoImovel("uf", e.target.value.toUpperCase())}
                  />
                </Campo>
                <Campo label="CEP" erro={erros["novo_imovel.cep"]}>
                  <Input
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={novo.cep}
                    onChange={(e) => setNovoImovel("cep", e.target.value)}
                  />
                </Campo>
                <Campo label="Dormitórios (quartos)" erro={erros["novo_imovel.quartos"]}>
                  <Input
                    inputMode="numeric"
                    value={novo.quartos}
                    onChange={(e) => setNovoImovel("quartos", e.target.value)}
                  />
                </Campo>
                <Campo label="Banheiros" erro={erros["novo_imovel.banheiros"]}>
                  <Input
                    inputMode="numeric"
                    value={novo.banheiros}
                    onChange={(e) => setNovoImovel("banheiros", e.target.value)}
                  />
                </Campo>
                <div className="space-y-2 md:col-span-2">
                  <Label>Características</Label>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <CheckItem
                      label="Sala"
                      checked={novo.sala}
                      onChange={(v) => setNovoImovel("sala", v)}
                    />
                    <CheckItem
                      label="Cozinha"
                      checked={novo.cozinha}
                      onChange={(v) => setNovoImovel("cozinha", v)}
                    />
                    <CheckItem
                      label="Quintal"
                      checked={novo.quintal}
                      onChange={(v) => setNovoImovel("quintal", v)}
                    />
                    <CheckItem
                      label="Área de serviço"
                      checked={novo.area_servico}
                      onChange={(v) => setNovoImovel("area_servico", v)}
                    />
                  </div>
                  <Input
                    placeholder="Outras características, separadas por vírgula"
                    value={novo.outras}
                    onChange={(e) => setNovoImovel("outras", e.target.value)}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {etapa === 1 && (
          <section className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h2 className="text-base font-semibold">2. Locador (proprietário)</h2>
                <ParteCampos
                  prefixo="locador"
                  valor={form.locador}
                  erros={erros}
                  onChange={setLocador}
                />
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label htmlFor="representado">Representado por procurador?</Label>
                    <p className="text-xs text-muted-foreground">
                      Marque se outra pessoa assina em nome do locador.
                    </p>
                  </div>
                  <Switch
                    id="representado"
                    checked={form.locador.representado}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, locador: { ...f.locador, representado: v } }))
                    }
                  />
                </div>
                {form.locador.representado && (
                  <div className="space-y-3 rounded-md border border-dashed p-3">
                    <h3 className="text-sm font-semibold">Procurador</h3>
                    <Campo label="Nome completo" erro={erros["locador.procurador.nome"]}>
                      <Input
                        value={form.locador.procurador.nome}
                        onChange={(e) => setProcurador("nome", e.target.value)}
                      />
                    </Campo>
                    <Campo label="CPF" erro={erros["locador.procurador.documento"]}>
                      <Input
                        inputMode="numeric"
                        value={form.locador.procurador.documento}
                        onChange={(e) => setProcurador("documento", e.target.value)}
                      />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="RG (número)" erro={erros["locador.procurador.rg"]}>
                        <Input
                          value={form.locador.procurador.rg}
                          onChange={(e) => setProcurador("rg", e.target.value)}
                        />
                      </Campo>
                      <Campo label="Órgão expedidor" erro={erros["locador.procurador.rg_orgao"]}>
                        <Input
                          placeholder="Ex.: SSP/SP"
                          value={form.locador.procurador.rg_orgao}
                          onChange={(e) => setProcurador("rg_orgao", e.target.value)}
                        />
                      </Campo>
                    </div>
                    <Campo label="CRECI" erro={erros["locador.procurador.creci"]}>
                      <Input
                        value={form.locador.procurador.creci}
                        onChange={(e) => setProcurador("creci", e.target.value)}
                      />
                    </Campo>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-semibold">Locatário (inquilino)</h2>
                <ParteCampos
                  prefixo="locatario"
                  valor={form.locatario}
                  erros={erros}
                  onChange={setLocatario}
                />
                <Campo label="Cônjuge (nome)" erro={erros["locatario.conjuge_nome"]}>
                  <Input
                    value={form.locatario.conjuge_nome}
                    onChange={(e) => setLocatario("conjuge_nome", e.target.value)}
                  />
                </Campo>
              </div>
            </div>
          </section>
        )}

        {etapa === 2 && (
          <section className="grid gap-4 md:grid-cols-2">
            <h2 className="text-base font-semibold md:col-span-2">3. Valores e condições</h2>

            <Campo label="Aluguel mensal (R$)" erro={erros["aluguel"]}>
              <CampoMoeda value={form.aluguel} onChange={(v) => set("aluguel", v)} />
            </Campo>

            <Campo label="IPTU mensal (R$) — opcional" erro={erros["valor_iptu"]}>
              <CampoMoeda value={form.valor_iptu} onChange={(v) => set("valor_iptu", v)} />
            </Campo>

            <Campo label="Condomínio (R$) — opcional" erro={erros["valor_condominio"]}>
              <CampoMoeda
                value={form.valor_condominio}
                onChange={(v) => set("valor_condominio", v)}
              />
            </Campo>

            <Campo label="Seguro (R$) — opcional" erro={erros["valor_seguro"]}>
              <CampoMoeda value={form.valor_seguro} onChange={(v) => set("valor_seguro", v)} />
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

            <div className="space-y-3 rounded-md border p-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Outras taxas mensais</Label>
                  <p className="text-xs text-muted-foreground">
                    Taxas extras cobradas todo mês (ex.: taxa de água, limpeza). Opcional.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={adicionarTaxa}
                  disabled={form.taxas.length >= MAX_TAXAS}
                >
                  <Plus className="mr-1 h-4 w-4" /> Adicionar taxa
                </Button>
              </div>
              {form.taxas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma taxa adicional.</p>
              )}
              {form.taxas.map((t, i) => (
                <div key={t.id} className="grid gap-2 md:grid-cols-[1fr_200px_auto] md:items-start">
                  <Campo label={`Descrição da taxa ${i + 1}`} erro={erros[`taxas.${i}.descricao`]}>
                    <Input
                      placeholder="Ex.: Taxa de água"
                      value={t.descricao}
                      onChange={(e) => alterarTaxa(t.id, "descricao", e.target.value)}
                    />
                  </Campo>
                  <Campo label="Valor (R$)" erro={erros[`taxas.${i}.valor`]}>
                    <CampoMoeda value={t.valor} onChange={(v) => alterarTaxa(t.id, "valor", v)} />
                  </Campo>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover taxa ${i + 1}`}
                    className="md:mt-7"
                    onClick={() => removerTaxa(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

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

            <BlocoResumo
              titulo="Imóvel"
              itens={
                form.imovel_modo === "existente"
                  ? [
                      ["Imóvel", imovelSelecionado?.titulo ?? "—"],
                      [
                        "Endereço",
                        [
                          imovelSelecionado?.endereco_logradouro,
                          imovelSelecionado?.endereco_numero,
                          imovelSelecionado?.endereco_bairro,
                          imovelSelecionado?.endereco_cidade,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—",
                      ],
                    ]
                  : [
                      ["Imóvel", tituloNovo],
                      [
                        "Endereço",
                        [
                          novo.logradouro,
                          novo.numero,
                          novo.complemento,
                          novo.bairro,
                          novo.cidade,
                          novo.uf,
                          novo.cep,
                        ]
                          .filter(Boolean)
                          .join(", "),
                      ],
                      [
                        "Dormitórios / banheiros",
                        `${novo.quartos || "—"} / ${novo.banheiros || "—"}`,
                      ],
                      ["Características", caracteristicasDe(novo).join(", ") || "—"],
                    ]
              }
            />

            <BlocoResumo
              titulo="Locador"
              itens={[
                ["Nome", form.locador.nome],
                ["Nacionalidade", form.locador.nacionalidade],
                ["Estado civil", form.locador.estado_civil],
                ["Profissão", form.locador.profissao],
                ["CPF / CNPJ", form.locador.documento],
                ["RG", rgComposto(form.locador.rg, form.locador.rg_orgao) ?? ""],
                ["Nascimento", formatData(form.locador.data_nascimento)],
                ["Endereço", form.locador.endereco],
                [
                  "Contato",
                  [form.locador.email, form.locador.telefone].filter(Boolean).join(" · "),
                ],
              ]}
            />

            {form.locador.representado && (
              <BlocoResumo
                titulo="Procurador do locador"
                itens={[
                  ["Nome", form.locador.procurador.nome],
                  ["CPF", form.locador.procurador.documento],
                  [
                    "RG",
                    rgComposto(form.locador.procurador.rg, form.locador.procurador.rg_orgao) ?? "",
                  ],
                  ["CRECI", form.locador.procurador.creci],
                  ["Relação", "representa o locador"],
                ]}
              />
            )}

            <BlocoResumo
              titulo="Locatário"
              itens={[
                ["Nome", form.locatario.nome],
                ["Nacionalidade", form.locatario.nacionalidade],
                ["Estado civil", form.locatario.estado_civil],
                ["Profissão", form.locatario.profissao],
                ["CPF / CNPJ", form.locatario.documento],
                ["RG", rgComposto(form.locatario.rg, form.locatario.rg_orgao) ?? ""],
                ["Nascimento", formatData(form.locatario.data_nascimento)],
                ["Endereço", form.locatario.endereco],
                [
                  "Contato",
                  [form.locatario.email, form.locatario.telefone].filter(Boolean).join(" · "),
                ],
                ["Cônjuge", form.locatario.conjuge_nome],
              ]}
            />

            <BlocoResumo
              titulo="Valores mensais"
              itens={[
                ["Aluguel", formatBRL(mensais.aluguel)],
                ["IPTU", mensais.iptu > 0 ? formatBRL(mensais.iptu) : "Não informado"],
                [
                  "Condomínio",
                  mensais.condominio > 0 ? formatBRL(mensais.condominio) : "Não informado",
                ],
                ["Seguro", mensais.seguro > 0 ? formatBRL(mensais.seguro) : "Não informado"],
                ...mensais.taxas.map((t): [string, string] => [t.descricao, formatBRL(t.valor)]),
                ["Total mensal", formatBRL(mensais.total)],
              ]}
            />

            <BlocoResumo
              titulo="Condições"
              itens={[
                ["Vencimento", `Dia ${form.dia_vencimento}`],
                ["Início", formatData(form.data_inicio)],
                [
                  "Prazo",
                  `${form.prazo_meses} meses (até ${formatData(somarMeses(form.data_inicio, Number(form.prazo_meses) || 0))})`,
                ],
                ["Renovação automática", form.renovacao_automatica ? "Sim" : "Não"],
                [
                  "Taxa de administração",
                  form.taxa_administracao_percentual
                    ? `${form.taxa_administracao_percentual}%`
                    : "Não informada",
                ],
                ["Reajuste", form.indice_reajuste],
              ]}
            />

            <p className="text-xs text-muted-foreground">
              {editando
                ? "As alterações são salvas na locação existente. Ela continua como rascunho até o Jurídico gerar o contrato."
                : "A locação será salva como rascunho, pronta para o Jurídico gerar o contrato."}
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
              {saving ? "Salvando…" : editando ? "Salvar alterações" : "Confirmar locação"}
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

function CheckItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border p-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

const ESTADO_CIVIL_OPCOES = ["", ...ESTADOS_CIVIS] as const;

function ParteCampos({
  valor,
  erros,
  prefixo,
  onChange,
}: {
  valor: ParteBaseForm;
  erros: Record<string, string>;
  prefixo: string;
  onChange: (k: keyof ParteBaseForm, v: string) => void;
}) {
  const erro = (campo: string) => erros[`${prefixo}.${campo}`];
  return (
    <div className="space-y-3">
      <Campo label="Nome completo" erro={erro("nome")}>
        <Input value={valor.nome} onChange={(e) => onChange("nome", e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Nacionalidade" erro={erro("nacionalidade")}>
          <Input
            value={valor.nacionalidade}
            onChange={(e) => onChange("nacionalidade", e.target.value)}
          />
        </Campo>
        <Campo label="Estado civil" erro={erro("estado_civil")}>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={valor.estado_civil}
            onChange={(e) => onChange("estado_civil", e.target.value)}
          >
            {ESTADO_CIVIL_OPCOES.map((op) => (
              <option key={op || "vazio"} value={op}>
                {op || "Não informado"}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo label="Profissão" erro={erro("profissao")}>
        <Input value={valor.profissao} onChange={(e) => onChange("profissao", e.target.value)} />
      </Campo>
      <Campo label="CPF / CNPJ" erro={erro("documento")}>
        <Input value={valor.documento} onChange={(e) => onChange("documento", e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="RG (número)" erro={erro("rg")}>
          <Input value={valor.rg} onChange={(e) => onChange("rg", e.target.value)} />
        </Campo>
        <Campo label="Órgão expedidor" erro={erro("rg_orgao")}>
          <Input
            placeholder="Ex.: SSP/SP"
            value={valor.rg_orgao}
            onChange={(e) => onChange("rg_orgao", e.target.value)}
          />
        </Campo>
      </div>
      <Campo label="Data de nascimento" erro={erro("data_nascimento")}>
        <Input
          type="date"
          value={valor.data_nascimento}
          onChange={(e) => onChange("data_nascimento", e.target.value)}
        />
      </Campo>
      <Campo label="Endereço" erro={erro("endereco")}>
        <Input value={valor.endereco} onChange={(e) => onChange("endereco", e.target.value)} />
      </Campo>
      <Campo label="E-mail" erro={erro("email")}>
        <Input
          type="email"
          value={valor.email}
          onChange={(e) => onChange("email", e.target.value)}
        />
      </Campo>
      <Campo label="Telefone" erro={erro("telefone")}>
        <Input value={valor.telefone} onChange={(e) => onChange("telefone", e.target.value)} />
      </Campo>
    </div>
  );
}

function BlocoResumo({ titulo, itens }: { titulo: string; itens: [string, string][] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <dl className="grid gap-2 md:grid-cols-2">
        {itens.map(([label, valor], i) => (
          <div key={`${i}-${label}`} className="rounded-md border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words font-medium">{valor || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
