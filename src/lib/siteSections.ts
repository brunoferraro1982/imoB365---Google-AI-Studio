export type SectionKey = "imoveis" | "sobre" | "blog_destaque" | "contato";

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
  sobre: "Sobre nós",
  blog_destaque: "Blog em destaque",
  contato: "Fale com a gente",
};

export const DEFAULT_SECOES: SectionDbItem[] = [
  { key: "imoveis", visivel: true, ordem: 0 },
  { key: "sobre", visivel: true, ordem: 1 },
  { key: "blog_destaque", visivel: false, ordem: 2 },
  { key: "contato", visivel: true, ordem: 3 },
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
    desc: "Hero com números, imóveis em grade, sobre e contato — o visual atual, sem nenhuma mudança.",
  },
  editorial: {
    label: "Editorial",
    desc: "Foco em conteúdo e credibilidade: sobre logo no início, blog em destaque, tipografia mais densa.",
  },
  vitrine: {
    label: "Vitrine",
    desc: "Alto contraste e imóveis em destaque grande — visual mais comercial, ideal para portfólio amplo.",
  },
  boutique: {
    label: "Boutique",
    desc: "Muito espaço em branco, visual discreto e elegante — ideal para atendimento mais exclusivo.",
  },
  amplo: {
    label: "Amplo",
    desc: "Layout largo com áreas configuráveis: escolha em qual coluna (menu lateral, conteúdo central ou coluna de destaque) cada bloco do seu site aparece.",
  },
};

export const LAYOUT_SUGGESTED_SECOES: Record<LayoutKey, SectionDbItem[]> = {
  classico: DEFAULT_SECOES,
  editorial: [
    { key: "sobre", visivel: true, ordem: 0 },
    { key: "blog_destaque", visivel: true, ordem: 1 },
    { key: "imoveis", visivel: true, ordem: 2 },
    { key: "contato", visivel: true, ordem: 3 },
  ],
  vitrine: [
    { key: "imoveis", visivel: true, ordem: 0 },
    { key: "contato", visivel: true, ordem: 1 },
    { key: "sobre", visivel: true, ordem: 2 },
    { key: "blog_destaque", visivel: false, ordem: 3 },
  ],
  boutique: [
    { key: "sobre", visivel: true, ordem: 0 },
    { key: "imoveis", visivel: true, ordem: 1 },
    { key: "contato", visivel: true, ordem: 2 },
    { key: "blog_destaque", visivel: false, ordem: 3 },
  ],
  amplo: [
    { key: "imoveis", visivel: true, ordem: 0, zona: "content" },
    { key: "contato", visivel: true, ordem: 1, zona: "content" },
    { key: "sobre", visivel: true, ordem: 0, zona: "navbar" },
    { key: "blog_destaque", visivel: false, ordem: 0, zona: "meta" },
  ],
};

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
