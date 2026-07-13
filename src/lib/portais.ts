export type PortalDef = {
  slug: string;
  nome: string;
  formato: "vrsync" | "olx";
  feedSuffix: string; // ex.: "vrsync.xml"
  descricao: string;
  disponivel: boolean;
};

export const PORTAIS: PortalDef[] = [
  {
    slug: "vivareal",
    nome: "VivaReal",
    formato: "vrsync",
    feedSuffix: "vrsync.xml",
    descricao: "Maior portal residencial do Brasil. Consome feed VRSync.",
    disponivel: true,
  },
  {
    slug: "zap",
    nome: "ZAP Imóveis",
    formato: "vrsync",
    feedSuffix: "vrsync.xml",
    descricao: "Portal do grupo OLX/ZAP. Consome o mesmo feed VRSync.",
    disponivel: true,
  },
  {
    slug: "wimoveis",
    nome: "Wimóveis (DF)",
    formato: "vrsync",
    feedSuffix: "vrsync.xml",
    descricao: "Portal regional do DF. Consome feed VRSync.",
    disponivel: true,
  },
  {
    slug: "chavesnamao",
    nome: "Chaves na Mão",
    formato: "vrsync",
    feedSuffix: "vrsync.xml",
    descricao: "Um dos maiores classificados de imóveis do Brasil. Consome feed VRSync.",
    disponivel: true,
  },
  {
    slug: "imovelweb",
    nome: "Imovelweb",
    formato: "vrsync",
    feedSuffix: "vrsync.xml",
    descricao: "Portal do grupo Navent/OLX com forte presença regional. Consome feed VRSync.",
    disponivel: true,
  },
  {
    slug: "mercadolivre",
    nome: "Mercado Livre Imóveis",
    formato: "vrsync",
    feedSuffix: "vrsync.xml",
    descricao: "Maior marketplace do Brasil, categoria Imóveis. Consome feed VRSync.",
    disponivel: true,
  },
  {
    slug: "olx",
    nome: "OLX Imóveis",
    formato: "olx",
    feedSuffix: "olx.xml",
    descricao: "Adapter dedicado OLX Realty XML para classificados.",
    disponivel: true,
  },
];

export const VRSYNC_PORTAL_SLUGS = PORTAIS.filter((p) => p.formato === "vrsync").map((p) => p.slug);

export function getPortal(slug: string) {
  return PORTAIS.find((p) => p.slug === slug);
}
