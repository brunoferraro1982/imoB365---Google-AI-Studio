// Motor de estimativa de valor de imóvel por m², localização (CEP/cidade/UF) e características.
// Os valores de referência abaixo representam médias de mercado aproximadas e devem ser
// revisados periodicamente — servem apenas como ponto de partida para uma estimativa,
// nunca como laudo de avaliação.

export type TipoImovelAvaliacao =
  | "apartamento"
  | "casa"
  | "casa_condominio"
  | "cobertura"
  | "terreno"
  | "comercial_sala"
  | "comercial_loja";

export type FinalidadeAvaliacao = "venda" | "locacao";

export type PadraoImovel = "economico" | "medio" | "alto" | "luxo";

export type ConservacaoImovel = "novo" | "seminovo" | "usado" | "reformar";

export const TIPO_AVALIACAO_LABEL: Record<TipoImovelAvaliacao, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  casa_condominio: "Casa em condomínio",
  cobertura: "Cobertura",
  terreno: "Terreno",
  comercial_sala: "Sala comercial",
  comercial_loja: "Loja comercial",
};

export const PADRAO_LABEL: Record<PadraoImovel, string> = {
  economico: "Econômico",
  medio: "Médio / Padrão",
  alto: "Alto padrão",
  luxo: "Luxo",
};

export const CONSERVACAO_LABEL: Record<ConservacaoImovel, string> = {
  novo: "Novo / lançamento",
  seminovo: "Seminovo (bem conservado)",
  usado: "Usado",
  reformar: "Precisa reforma",
};

// R$/m² médio de referência (padrão médio, venda) por cidade — inclui Litoral Sul de SP
// (praça de origem da imoB365) e as principais capitais.
const REFERENCIA_CIDADE: Record<string, number> = {
  "sao paulo|sp": 9800,
  "guaruja|sp": 8600,
  "santos|sp": 8200,
  "sao vicente|sp": 5800,
  "praia grande|sp": 5200,
  "itanhaem|sp": 4300,
  "mongagua|sp": 3900,
  "peruibe|sp": 4100,
  "bertioga|sp": 7400,
  "cubatao|sp": 4600,
  "campinas|sp": 7100,
  "rio de janeiro|rj": 10200,
  "niteroi|rj": 8300,
  "belo horizonte|mg": 7000,
  "curitiba|pr": 7200,
  "porto alegre|rs": 6800,
  "florianopolis|sc": 9600,
  "brasilia|df": 8700,
  "salvador|ba": 6200,
  "fortaleza|ce": 6100,
  "recife|pe": 6300,
  "goiania|go": 5400,
  "vitoria|es": 6900,
};

// R$/m² médio de referência por UF, usado quando a cidade não está no mapa acima.
const REFERENCIA_UF: Record<string, number> = {
  sp: 6800,
  rj: 7200,
  mg: 5400,
  pr: 5600,
  rs: 5300,
  sc: 6600,
  ba: 4800,
  pe: 4700,
  ce: 4500,
  df: 7600,
  go: 4600,
  es: 5100,
  pa: 4200,
  am: 4000,
  mt: 4400,
  ms: 4500,
  pb: 4100,
  rn: 4600,
  al: 3900,
  se: 3900,
  pi: 3600,
  ma: 3700,
  to: 3700,
  ro: 3800,
  ac: 3600,
  rr: 3600,
  ap: 3700,
};

const VALOR_M2_NACIONAL_PADRAO = 4900;

const MULTIPLICADOR_TIPO: Record<TipoImovelAvaliacao, number> = {
  apartamento: 1,
  cobertura: 1.35,
  casa: 0.95,
  casa_condominio: 1.15,
  terreno: 0.45,
  comercial_sala: 0.9,
  comercial_loja: 1,
};

const MULTIPLICADOR_PADRAO: Record<PadraoImovel, number> = {
  economico: 0.75,
  medio: 1,
  alto: 1.35,
  luxo: 1.9,
};

const MULTIPLICADOR_CONSERVACAO: Record<ConservacaoImovel, number> = {
  novo: 1.08,
  seminovo: 1,
  usado: 0.92,
  reformar: 0.78,
};

// Regra prática de mercado: aluguel mensal ~0,4%–0,6% do valor de venda do imóvel.
const RENTAL_YIELD_MENSAL = 0.005;

// Faixa de variação exibida ao redor do valor médio, para deixar claro que é uma estimativa.
const FAIXA_VARIACAO = 0.15;

const DIACRITICOS_REGEX = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g",
);

function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(DIACRITICOS_REGEX, "").toLowerCase().trim();
}

export type FonteRegional = "cidade" | "estado" | "nacional";

export function obterValorM2Base(
  cidade: string | undefined,
  uf: string | undefined,
): { valor: number; fonte: FonteRegional } {
  if (cidade && uf) {
    const chave = `${normalizarTexto(cidade)}|${normalizarTexto(uf)}`;
    const valorCidade = REFERENCIA_CIDADE[chave];
    if (valorCidade) return { valor: valorCidade, fonte: "cidade" };
  }
  if (uf) {
    const valorUf = REFERENCIA_UF[normalizarTexto(uf)];
    if (valorUf) return { valor: valorUf, fonte: "estado" };
  }
  return { valor: VALOR_M2_NACIONAL_PADRAO, fonte: "nacional" };
}

export interface EstimativaInput {
  metragem: number;
  tipo: TipoImovelAvaliacao;
  finalidade: FinalidadeAvaliacao;
  padrao: PadraoImovel;
  conservacao: ConservacaoImovel;
  cidade?: string;
  uf?: string;
}

export interface EstimativaResultado {
  valorM2Base: number;
  valorM2Ajustado: number;
  valorMedio: number;
  valorMinimo: number;
  valorMaximo: number;
  aluguelMedio?: number;
  aluguelMinimo?: number;
  aluguelMaximo?: number;
  fonteRegional: FonteRegional;
}

export function estimarValorImovel(input: EstimativaInput): EstimativaResultado {
  const { valor: valorM2Base, fonte } = obterValorM2Base(input.cidade, input.uf);

  const valorM2Ajustado =
    valorM2Base *
    MULTIPLICADOR_TIPO[input.tipo] *
    MULTIPLICADOR_PADRAO[input.padrao] *
    MULTIPLICADOR_CONSERVACAO[input.conservacao];

  const metragem = Math.max(input.metragem || 0, 0);
  const valorMedio = valorM2Ajustado * metragem;
  const valorMinimo = valorMedio * (1 - FAIXA_VARIACAO);
  const valorMaximo = valorMedio * (1 + FAIXA_VARIACAO);

  const base: EstimativaResultado = {
    valorM2Base,
    valorM2Ajustado,
    valorMedio,
    valorMinimo,
    valorMaximo,
    fonteRegional: fonte,
  };

  if (input.finalidade === "locacao") {
    const aluguelMedio = valorMedio * RENTAL_YIELD_MENSAL;
    return {
      ...base,
      aluguelMedio,
      aluguelMinimo: aluguelMedio * (1 - FAIXA_VARIACAO),
      aluguelMaximo: aluguelMedio * (1 + FAIXA_VARIACAO),
    };
  }

  return base;
}
