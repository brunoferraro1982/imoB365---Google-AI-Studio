export type SectionKey =
  | "imoveis"
  | "empreendimentos"
  | "diferenciais"
  | "sobre"
  | "como_funciona"
  | "blog_destaque"
  | "contato";

export type Zona = "navbar" | "content" | "meta";

export type SectionDbItem = {
  key: SectionKey;
  visivel: boolean;
  ordem: number;
  /** Área da página onde o bloco aparece — só usada pelo layout 'amplo'. Default 'content'. */
  zona?: Zona;
};

export const SECTION_LABELS: Record<SectionKey, string> = {
  imoveis: "Imóveis em destaque",
  empreendimentos: "Lançamentos e empreendimentos",
  diferenciais: "Diferenciais",
  sobre: "Sobre nós",
  como_funciona: "Como funciona",
  blog_destaque: "Blog em destaque",
  contato: "Fale com a gente",
};

export const DEFAULT_SECOES: SectionDbItem[] = [
  { key: "imoveis", visivel: true, ordem: 0 },
  { key: "empreendimentos", visivel: true, ordem: 1 },
  { key: "diferenciais", visivel: true, ordem: 2 },
  { key: "sobre", visivel: true, ordem: 3 },
  { key: "como_funciona", visivel: true, ordem: 4 },
  { key: "blog_destaque", visivel: false, ordem: 5 },
  { key: "contato", visivel: true, ordem: 6 },
];

export type LayoutKey = "classico" | "editorial" | "vitrine" | "boutique" | "amplo";

export const ZONA_LABELS: Record<Zona, string> = {
  navbar: "Menu lateral",
  content: "Conteúdo central",
  meta: "Coluna de destaque",
};

export const LAYOUT_INFO: Record<LayoutKey, { label: string; desc: string }> = {
  classico: {
    label: "Clássico",
    desc: "Liquid Glass com topo escuro, retrato, formulário de contato e imóveis em grade — equilibrado para qualquer perfil.",
  },
  editorial: {
    label: "Editorial",
    desc: "Liquid Glass claro com foco em credibilidade: sobre e diferenciais logo no início, blog em destaque.",
  },
  vitrine: {
    label: "Vitrine",
    desc: "Liquid Glass de alto contraste com imóveis e lançamentos em primeiro plano — ideal para portfólio amplo.",
  },
  boutique: {
    label: "Boutique",
    desc: "Liquid Glass claro, com muito respiro e tipografia elegante — ideal para atendimento mais exclusivo.",
  },
  amplo: {
    label: "Amplo",
    desc: "Liquid Glass em layout largo com áreas configuráveis: escolha a coluna (menu lateral, conteúdo central ou destaque) de cada bloco.",
  },
};

const seq = (keys: [SectionKey, boolean, Zona?][]): SectionDbItem[] =>
  keys.map(([key, visivel, zona], ordem) => ({ key, visivel, ordem, ...(zona ? { zona } : {}) }));

export const LAYOUT_SUGGESTED_SECOES: Record<LayoutKey, SectionDbItem[]> = {
  classico: DEFAULT_SECOES,
  editorial: seq([
    ["sobre", true],
    ["diferenciais", true],
    ["blog_destaque", true],
    ["imoveis", true],
    ["empreendimentos", true],
    ["como_funciona", true],
    ["contato", true],
  ]),
  vitrine: seq([
    ["imoveis", true],
    ["empreendimentos", true],
    ["como_funciona", true],
    ["contato", true],
    ["diferenciais", true],
    ["sobre", true],
    ["blog_destaque", false],
  ]),
  boutique: seq([
    ["sobre", true],
    ["imoveis", true],
    ["diferenciais", true],
    ["empreendimentos", true],
    ["como_funciona", false],
    ["contato", true],
    ["blog_destaque", false],
  ]),
  amplo: [
    { key: "imoveis", visivel: true, ordem: 0, zona: "content" },
    { key: "empreendimentos", visivel: true, ordem: 1, zona: "content" },
    { key: "como_funciona", visivel: true, ordem: 2, zona: "content" },
    { key: "contato", visivel: true, ordem: 3, zona: "content" },
    { key: "sobre", visivel: true, ordem: 0, zona: "navbar" },
    { key: "diferenciais", visivel: true, ordem: 0, zona: "meta" },
    { key: "blog_destaque", visivel: false, ordem: 1, zona: "meta" },
  ],
};

/**
 * Sites salvos antes das seções novas (empreendimentos, diferenciais,
 * como_funciona) não têm essas chaves em `secoes`. Aqui elas entram
 * visíveis, logo depois da seção que as precede na ordem padrão — assim os
 * sites já publicados ganham o conteúdo novo sem o tenant precisar editar.
 */
export function normalizarSecoes(salvas: SectionDbItem[] | null | undefined): SectionDbItem[] {
  if (!salvas?.length) return DEFAULT_SECOES;
  const lista = salvas
    .filter((s) => s.key in SECTION_LABELS)
    .slice()
    .sort((a, b) => a.ordem - b.ordem);
  const ordemPadrao = DEFAULT_SECOES.map((s) => s.key);
  for (const padrao of DEFAULT_SECOES) {
    if (lista.some((s) => s.key === padrao.key)) continue;
    const anteriores = ordemPadrao.slice(0, ordemPadrao.indexOf(padrao.key)).reverse();
    const ancora = anteriores.map((k) => lista.findIndex((s) => s.key === k)).find((i) => i >= 0);
    const novo: SectionDbItem = { key: padrao.key, visivel: padrao.visivel, ordem: 0 };
    lista.splice(ancora === undefined ? lista.length : ancora + 1, 0, novo);
  }
  return lista.map((s, ordem) => ({ ...s, ordem }));
}

export type Diferencial = { icone: string; titulo: string; texto: string };
export type Passo = { titulo: string; texto: string };

export const DIFERENCIAIS_PADRAO: Diferencial[] = [
  {
    icone: "shield",
    titulo: "Atendimento de confiança",
    texto: "Acompanhamento próximo do primeiro contato até a entrega das chaves.",
  },
  {
    icone: "search",
    titulo: "Curadoria sob medida",
    texto: "Opções selecionadas de acordo com o seu perfil, orçamento e momento de vida.",
  },
  {
    icone: "file",
    titulo: "Financiamento sem complicação",
    texto: "Ajuda com simulação, documentação e aprovação do crédito.",
  },
];

export const COMO_FUNCIONA_PADRAO: Passo[] = [
  {
    titulo: "Conte o que procura",
    texto: "Orçamento, região, tamanho e quando pretende se mudar.",
  },
  { titulo: "Receba a seleção", texto: "Opções sob medida direto no seu WhatsApp, sem enrolação." },
  {
    titulo: "Visite e feche negócio",
    texto: "Acompanhamento na visita, na negociação, no financiamento e na documentação.",
  },
];

/** Usa o conteúdo salvo quando houver ao menos 1 item preenchido; senão, o padrão. */
export function itensOuPadrao<T extends { titulo: string }>(salvos: unknown, padrao: T[]): T[] {
  const lista = Array.isArray(salvos)
    ? (salvos as T[]).filter((i) => i && typeof i.titulo === "string" && i.titulo.trim())
    : [];
  return lista.length ? lista : padrao;
}

export function secoesEqual(a: SectionDbItem[], b: SectionDbItem[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.ordem - y.ordem);
  const sortedB = [...b].sort((x, y) => x.ordem - y.ordem);
  return sortedA.every(
    (item, i) =>
      item.key === sortedB[i].key &&
      item.visivel === sortedB[i].visivel &&
      (item.zona ?? "content") === (sortedB[i].zona ?? "content"),
  );
}
