export type FaixaRisco = "excelente" | "aprovado" | "recusado";

export type FatorRisco = { label: string; valor: number };
export type PontoHistorico = { mes: string; score: number };

export type AnaliseRisco = {
  score: number;
  faixa: FaixaRisco;
  status: string;
  pendencias: string;
  fatores: FatorRisco[];
  historico: PontoHistorico[];
  recomendacoes: string[];
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Deriva score/faixa/status/pendências a partir do CPF — mesma regra
 * determinística já usada no widget de app.leads.$id.tsx (último dígito),
 * agora compartilhada. Fatores e histórico são derivados de outras
 * posições do CPF, coerentes com a faixa, para dar substância visual à
 * apresentação (sempre o mesmo resultado para o mesmo CPF).
 */
export function gerarAnaliseRisco(cpf: string): AnaliseRisco {
  const digits = cpf.replace(/\D/g, "");
  const digitAt = (i: number) => Number(digits[i] || 0);
  const lastDigit = digitAt(digits.length - 1);

  let score: number;
  let faixa: FaixaRisco;
  let status: string;
  let pendencias: string;

  if (lastDigit % 3 === 0) {
    score = 890;
    faixa = "excelente";
    status = "Crédito Excelente (Aprovado Instantâneo)";
    pendencias = "Nada Consta na base Serasa / Cadastro Positivo Ativo.";
  } else if (lastDigit % 2 === 0) {
    score = 720;
    faixa = "aprovado";
    status = "Aprovado com Cartão-Fiança / Seguro Aluguel";
    pendencias = "Sem protestos de títulos. Histórico adimplente.";
  } else {
    score = 310;
    faixa = "recusado";
    status = "Crédito Recusado - Exige Caução de 3 meses ou Fiador Fiduciário";
    pendencias = "Pendência financeira ativa registrada por instituição bancária.";
  }

  const baseFator = faixa === "excelente" ? 78 : faixa === "aprovado" ? 55 : 28;
  const fatores: FatorRisco[] = [
    { label: "Pontualidade de pagamentos", valor: clamp(baseFator + digitAt(0) * 2) },
    { label: "Utilização de crédito", valor: clamp(baseFator + digitAt(2) * 2 - 5) },
    { label: "Tempo de relacionamento bancário", valor: clamp(baseFator + digitAt(4) * 2) },
    { label: "Diversidade de crédito", valor: clamp(baseFator + digitAt(6) * 2 - 8) },
    { label: "Consultas recentes ao CPF", valor: clamp(baseFator + digitAt(8) * 2 - 10) },
  ];

  const historico: PontoHistorico[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const variacao = i === 0 ? 0 : (digitAt(5 - (i % 5)) - 5) * 6 - i * 4;
    historico.push({ mes: MESES[d.getMonth()], score: clamp(score + variacao, 0, 1000) });
  }
  historico[historico.length - 1] = { mes: historico[historico.length - 1].mes, score };

  const recomendacoes: string[] =
    faixa === "excelente"
      ? [
          "Perfil de baixíssimo risco — pode dispensar garantias adicionais além do contrato padrão.",
          "Elegível para aprovação instantânea, agilizando o fechamento do negócio.",
          "Bom argumento de venda: reforce ao proprietário a solidez financeira do proponente.",
        ]
      : faixa === "aprovado"
        ? [
            "Perfil aprovado com reservas — recomenda-se seguro-fiança ou cartão de crédito como garantia.",
            "Histórico adimplente reduz o risco de inadimplência, mas mantenha o acompanhamento.",
            "Apresente ao proprietário a opção de seguro-fiança como reforço de segurança.",
          ]
        : [
            "Perfil de maior risco — recomenda-se caução de 3 meses ou fiador com comprovação de renda.",
            "Sugira ao proprietário uma garantia reforçada antes de prosseguir com a negociação.",
            "Considere reavaliar o valor do contrato ou condições de pagamento.",
          ];

  return { score, faixa, status, pendencias, fatores, historico, recomendacoes };
}
