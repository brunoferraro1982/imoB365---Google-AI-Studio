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

export function maskCPF(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (base: string) => {
    let sum = 0;
    let weight = base.length + 1;
    for (const ch of base) {
      sum += Number(ch) * weight;
      weight--;
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(digits.slice(0, 9));
  const d2 = calcDigit(digits.slice(0, 9) + d1);
  return digits === digits.slice(0, 9) + String(d1) + String(d2);
}
