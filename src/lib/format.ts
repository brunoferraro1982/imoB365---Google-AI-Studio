export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function formatBRL(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export const FINALIDADE_LABEL: Record<string, string> = {
  venda: "Venda",
  aluguel: "Aluguel",
  temporada: "Temporada",
};

export const TIPO_LABEL: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  casa_condominio: "Casa em condomínio",
  sobrado: "Sobrado",
  cobertura: "Cobertura",
  flat: "Flat",
  kitnet: "Kitnet",
  terreno: "Terreno",
  sitio: "Sítio",
  chacara: "Chácara",
  fazenda: "Fazenda",
  comercial_sala: "Sala comercial",
  comercial_loja: "Loja",
  comercial_galpao: "Galpão",
  comercial_predio: "Prédio comercial",
  outro: "Outro",
};

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  inativo: "Inativo",
  vendido: "Vendido",
  alugado: "Alugado",
  reservado: "Reservado",
};

export function formatQuota(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n === -1) return "Ilimitado";
  return String(n);
}
