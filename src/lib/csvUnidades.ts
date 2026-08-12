// Fase 3 do Assistente de importação de construtoras: parser de CSV de tabela
// de unidades (espelho de unidades de um empreendimento). Puro e testável —
// aceita separador `,` ou `;`, cabeçalho flexível (tolerante a acento/caixa) e
// números no formato BR ("R$ 1.250.000,00", "82,14 m²").

export type UnidadeCsv = {
  numero: string;
  bloco: string | null;
  andar: number | null;
  tipo_planta: string | null;
  area: number | null;
  preco: number | null;
};

export function parseNumeroBR(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = String(raw).match(/-?[\d.,]+/);
  if (!m) return null;
  let s = m[0];
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) s = s.replace(",", ".");
  else if (hasDot) {
    const p = s.split(".");
    if (p.length > 2 || (p.length === 2 && p[1].length === 3)) s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function parseCsvUnidades(texto: string): UnidadeCsv[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (linhas.length < 2) return [];
  const sep =
    (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const cols = linhas[0].split(sep).map(normHeader);
  const idx = (...alts: string[]) => cols.findIndex((c) => alts.some((a) => c.includes(a)));
  const iNumero = idx("numero", "unidade", "apto", "apt");
  const iBloco = idx("bloco", "torre");
  const iAndar = idx("andar", "pavimento");
  const iPlanta = idx("planta", "tipo");
  const iArea = idx("area", "m2", "metragem");
  const iPreco = idx("preco", "valor");
  const val = (arr: string[], i: number) => (i >= 0 && i < arr.length ? arr[i].trim() : "");
  const out: UnidadeCsv[] = [];
  for (let r = 1; r < linhas.length; r++) {
    const c = linhas[r].split(sep);
    const numero = val(c, iNumero);
    if (!numero) continue;
    out.push({
      numero,
      bloco: val(c, iBloco) || null,
      andar: parseNumeroBR(val(c, iAndar)),
      tipo_planta: val(c, iPlanta) || null,
      area: parseNumeroBR(val(c, iArea)),
      preco: parseNumeroBR(val(c, iPreco)),
    });
  }
  return out;
}
