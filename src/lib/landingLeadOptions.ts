// Opções do formulário das landings de campanha (/lp/*) — compartilhadas
// entre a página (client) e a server function que valida o envio.

export const FAIXAS_INVESTIMENTO = {
  "ate-300": { label: "Até R$ 300 mil", teto: 300_000 },
  "300-500": { label: "R$ 300 a 500 mil", teto: 500_000 },
  "500-800": { label: "R$ 500 a 800 mil", teto: 800_000 },
  "800-1200": { label: "R$ 800 mil a 1,2 milhão", teto: 1_200_000 },
  "acima-1200": { label: "Acima de R$ 1,2 milhão", teto: null },
} as const;
export type FaixaInvestimento = keyof typeof FAIXAS_INVESTIMENTO;

export const MORA_EM = [
  "São Paulo (capital)",
  "Guarulhos",
  "ABC Paulista",
  "Outra cidade",
] as const;

export const PRAZO_COMPRA = [
  "Nos próximos 3 meses",
  "Em 3 a 6 meses",
  "Em 6 a 12 meses",
  "Só pesquisando por enquanto",
] as const;

/** WhatsApp oficial da imoB365 (o mesmo do JSON-LD do root e de /contato). */
export const WHATSAPP_IMOB365 = "5513997794382";
