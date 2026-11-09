// Checklist de documentos dos contratos (Jurídico).
// Etapas e tipos seguem o workflow de contratos: o item de um modelo cai na
// mesma etapa em que aparece no contrato, então não existe mais "documentos"
// fora do fluxo.

export const ETAPAS_CHECKLIST = [
  { value: "captacao", label: "Captação" },
  { value: "analise", label: "Análise" },
  { value: "documentacao", label: "Documentação" },
  { value: "juridico", label: "Jurídico" },
  { value: "assinatura", label: "Assinatura" },
  { value: "ativacao", label: "Ativação" },
  { value: "financeiro", label: "Financeiro" },
  { value: "administracao", label: "Administração" },
  { value: "encerramento", label: "Encerramento" },
] as const;

export type EtapaChecklist = (typeof ETAPAS_CHECKLIST)[number]["value"];

export const ETAPA_LABEL: Record<string, string> = Object.fromEntries(
  ETAPAS_CHECKLIST.map((e) => [e.value, e.label]),
);

export const TIPOS_CHECKLIST = [
  { value: "venda", label: "Venda", descricao: "Compra e venda de imóvel com escritura." },
  { value: "locacao", label: "Locação", descricao: "Aluguel residencial ou comercial." },
  { value: "permuta", label: "Permuta", descricao: "Troca de imóvel, com ou sem torna." },
  { value: "exclusividade", label: "Exclusividade", descricao: "Autorização de venda exclusiva." },
  { value: "administracao", label: "Administração", descricao: "Gestão de imóvel para terceiros." },
  { value: "parceria", label: "Parceria", descricao: "Divisão de comissão entre corretores." },
  { value: "prestacao_servico", label: "Prestação de serviço", descricao: "Serviços contratados." },
  { value: "captacao", label: "Captação", descricao: "Captação de imóvel para anúncio." },
  { value: "outro", label: "Outro", descricao: "Demais contratos." },
] as const;

export const TIPO_CHECKLIST_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_CHECKLIST.map((t) => [t.value, t.label]),
);

export type ItemSugerido = { etapa: EtapaChecklist; titulo: string; obrigatorio: boolean };

// Sugestões de ponto de partida por tipo. São editáveis: ao criar o modelo,
// o usuário pode renomear, remover e acrescentar itens.
export const SUGESTOES_POR_TIPO: Record<string, ItemSugerido[]> = {
  venda: [
    {
      etapa: "documentacao",
      titulo: "Matrícula do imóvel atualizada (até 30 dias)",
      obrigatorio: true,
    },
    { etapa: "documentacao", titulo: "Certidões negativas do vendedor", obrigatorio: true },
    { etapa: "documentacao", titulo: "IPTU e condomínio quitados", obrigatorio: true },
    {
      etapa: "documentacao",
      titulo: "Documentos pessoais de vendedor e comprador",
      obrigatorio: true,
    },
    { etapa: "juridico", titulo: "Análise da documentação pelo jurídico", obrigatorio: true },
    {
      etapa: "assinatura",
      titulo: "Assinatura do contrato pelas partes e testemunhas",
      obrigatorio: true,
    },
    { etapa: "financeiro", titulo: "Comprovante do sinal recebido", obrigatorio: false },
    { etapa: "ativacao", titulo: "Registro da escritura no cartório", obrigatorio: true },
  ],
  locacao: [
    { etapa: "documentacao", titulo: "Documentos pessoais do locatário", obrigatorio: true },
    { etapa: "documentacao", titulo: "Comprovante de renda", obrigatorio: true },
    {
      etapa: "documentacao",
      titulo: "Garantia (fiador, caução ou seguro-fiança)",
      obrigatorio: true,
    },
    { etapa: "juridico", titulo: "Análise de crédito e garantia", obrigatorio: true },
    {
      etapa: "assinatura",
      titulo: "Assinatura do contrato pelo locatário e fiador",
      obrigatorio: true,
    },
    { etapa: "financeiro", titulo: "Pagamento do primeiro aluguel e caução", obrigatorio: true },
    { etapa: "ativacao", titulo: "Entrega das chaves e vistoria de entrada", obrigatorio: true },
  ],
};

export const SUGESTAO_GENERICA: ItemSugerido[] = [
  { etapa: "documentacao", titulo: "Documentos das partes", obrigatorio: true },
  { etapa: "juridico", titulo: "Revisão jurídica", obrigatorio: true },
  { etapa: "assinatura", titulo: "Assinatura das partes", obrigatorio: true },
];

export function sugestoesDoTipo(tipo: string): ItemSugerido[] {
  return SUGESTOES_POR_TIPO[tipo] ?? SUGESTAO_GENERICA;
}

/** Agrupa itens por etapa, na ordem do workflow. */
export function agruparPorEtapa<T extends { etapa: string }>(itens: T[]) {
  const grupos: { etapa: string; label: string; itens: T[] }[] = [];
  for (const e of ETAPAS_CHECKLIST) {
    const lista = itens.filter((i) => i.etapa === e.value);
    if (lista.length) grupos.push({ etapa: e.value, label: e.label, itens: lista });
  }
  // etapas fora da lista (dados antigos) entram no fim, sem perder nada
  const conhecidas = new Set<string>(ETAPAS_CHECKLIST.map((e) => e.value));
  const resto = itens.filter((i) => !conhecidas.has(i.etapa));
  if (resto.length) grupos.push({ etapa: "outras", label: "Outras", itens: resto });
  return grupos;
}
