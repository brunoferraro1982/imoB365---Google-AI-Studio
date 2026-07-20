export type SectionKey = "imoveis" | "sobre" | "blog_destaque" | "contato";

export type SectionDbItem = { key: SectionKey; visivel: boolean; ordem: number };

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
