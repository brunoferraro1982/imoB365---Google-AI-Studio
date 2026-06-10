export type PortalCredentialField = {
  key: string;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
  helper?: string;
};

export type PortalDef = {
  slug: string;
  nome: string;
  formato: "vrsync" | "olx";
  feedSuffix: string; // ex.: "vrsync.xml"
  descricao: string;
  disponivel: boolean;
  credentialFields?: PortalCredentialField[];
};

export const PORTAIS: PortalDef[] = [
  {
    slug: "vivareal",
    nome: "VivaReal",
    formato: "vrsync",
    feedSuffix: "vrsync.xml",
    descricao: "Maior portal residencial do Brasil. Consome feed VRSync.",
    disponivel: true,
    credentialFields: [
      {
        key: "client_id",
        label: "Client ID",
        type: "text",
        placeholder: "ID do cliente no VivaReal",
      },
      { key: "client_secret", label: "Client Secret", type: "password" },
      {
        key: "account_id",
        label: "ID da conta / anunciante",
        type: "text",
        helper: "Encontrado no painel do portal",
      },
    ],
  },
  {
    slug: "zap",
    nome: "ZAP Imóveis",
    formato: "vrsync",
    feedSuffix: "vrsync.xml",
    descricao: "Portal do grupo OLX/ZAP. Consome o mesmo feed VRSync.",
    disponivel: true,
    credentialFields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "account_id", label: "ID da conta / anunciante", type: "text" },
    ],
  },
  {
    slug: "wimoveis",
    nome: "Wimóveis (DF)",
    formato: "vrsync",
    feedSuffix: "vrsync.xml",
    descricao: "Portal regional do DF. Consome feed VRSync.",
    disponivel: true,
    credentialFields: [
      { key: "api_key", label: "Chave de API", type: "password" },
      { key: "account_id", label: "ID do anunciante", type: "text" },
    ],
  },
  {
    slug: "olx",
    nome: "OLX Imóveis",
    formato: "olx",
    feedSuffix: "olx.xml",
    descricao: "Adapter dedicado OLX Realty XML para classificados.",
    disponivel: true,
    credentialFields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "account_id", label: "ID da conta OLX", type: "text" },
    ],
  },
];

export function getPortal(slug: string) {
  return PORTAIS.find((p) => p.slug === slug);
}
