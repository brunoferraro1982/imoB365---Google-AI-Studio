// Parser das "Tabelas de Vendas" da Econ (PDF → texto via unpdf, uma linha
// por unidade: BLOCO · m² · zona · dorms · vagas · tipo · unidade · status ·
// valores… · preço). Usado pela sincronização semanal de fornecedores.

export type UnidadeTabela = {
  area: number;
  dorms: number;
  vagas: number;
  tipo: string;
  status: string;
  preco: number;
};

const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

const LINHA =
  /(\d+,\d+)\s?m²\s+\S+\s+(\d)\s+(\d)\s+(TIPO|SALA AMPLIADA|GARDEN|DUPLEX|COBERTURA)\s+\S+\s+(Disponível|Em Análise|Em Negociação|Reservad\w*|Vendid\w*|Bloquead\w*|Indispon\w*)((?:\s+[\d.]+,\d{2})+)/g;

export function parseTabelaEcon(texto: string): UnidadeTabela[] {
  const out: UnidadeTabela[] = [];
  for (const m of texto.matchAll(LINHA)) {
    const valores = m[6].trim().split(/\s+/).map(num);
    out.push({
      area: num(m[1]),
      dorms: Number(m[2]),
      vagas: Number(m[3]),
      tipo: m[4],
      status: m[5],
      preco: valores[valores.length - 1],
    });
  }
  return out;
}

/**
 * Menor preço disponível para uma planta (mesmo nº de dorms e área até
 * ±1,5 m² da área cadastrada). Unidades "sala ampliada" ficam de fora, como
 * na importação. Retorna null se não houver unidade compatível disponível.
 */
export function precoPlanta(
  unidades: UnidadeTabela[],
  planta: { area: number; dorms: number },
): number | null {
  const candidatas = unidades.filter(
    (u) =>
      u.status === "Disponível" &&
      u.tipo === "TIPO" &&
      (u.dorms === planta.dorms || u.dorms === 0) &&
      u.area >= planta.area - 0.5 &&
      u.area <= planta.area + 1.5 &&
      u.preco > 50_000,
  );
  if (!candidatas.length) return null;
  return Math.min(...candidatas.map((u) => u.preco));
}
