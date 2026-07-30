// Extração por IA (Gemini) pra ingestão de construtoras parceiras —
// extensão de ai.functions.ts, primeiro uso multimodal (imagem/PDF) do
// projeto (o resto de ai.functions.ts só manda texto). Validado
// manualmente contra a API real antes de integrar: uma foto real do GMV
// (thumbnail do Drive) e um PDF real de tabela de preços (Residencial The
// One) — ambos retornaram JSON estruturado corretamente.
//
// Tudo aqui é probabilístico por natureza (uma IA "lendo" uma foto ou um
// PDF nunca é 100% confiável) — por isso nada disso publica sozinho.
// Score de fotos só marca "recomendada" (pré-seleção, humano ainda decide
// na revisão); extração de PDF só preenche `dados_extraidos` do lote
// (rascunho), nunca cria/atualiza um empreendimento/imóvel publicado
// diretamente.
import {
  GoogleGenAI,
  createUserContent,
  createPartFromText,
  createPartFromBase64,
} from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";

// Mesmo valor de construtoraIngestao.ts (duplicado, não importado, pra
// evitar import circular entre os dois arquivos) — sem timeout, um
// rate-limit silencioso do Google (conexão pendurada em vez de 429/403)
// trava a chamada pra sempre.
const FETCH_TIMEOUT_MS = 15000;

let _ai: InstanceType<typeof GoogleGenAI> | null = null;
function getAI(): InstanceType<typeof GoogleGenAI> {
  if (_ai) return _ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "SUA_GEMINI_KEY") {
    throw new Error(
      "GEMINI_API_KEY não configurada. Substitua o valor placeholder no .env por uma chave válida do Google AI Studio.",
    );
  }
  _ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
  return _ai;
}

export type CategoriaFoto = "fachada" | "lazer" | "planta" | "outro";

export type FotoParaAvaliar = { id: string; thumbnailUrl: string };
export type AvaliacaoFoto = {
  id: string;
  score: number;
  legenda: string;
  categoria: CategoriaFoto;
};

// Manda o thumbnailLink que a própria Drive API já devolve (não o arquivo
// original) — muito mais barato/rápido que baixar cada foto candidata só
// pra pontuar relevância. Só o download em resolução real acontece depois,
// pras fotos efetivamente aprovadas na revisão (Fase 3).
const MAX_FOTOS_POR_CHAMADA = 12;

// A IA também classifica a categoria pela imagem em si (fachada/lazer/
// planta/outro), não só pontua — achado real testando contra o GMV: a
// classificação por nome de pasta (construtoraIngestao.ts) erra bastante
// (pastas com nomes inconsistentes entre empreendimentos, ex. "Imagens 3D"
// em vez de "Perspectivas"), e a maioria das fotos reais caía em "outro"
// e NUNCA chegava a ser avaliada (o código só pontuava as 3 categorias já
// bem-classificadas) — a IA reclassifica com base no que a foto realmente
// mostra, corrigindo a categoria herdada da pasta quando necessário.
export async function avaliarFotos(fotos: FotoParaAvaliar[]): Promise<AvaliacaoFoto[]> {
  if (fotos.length === 0) return [];
  const ai = getAI();
  const resultados: AvaliacaoFoto[] = [];

  for (let i = 0; i < fotos.length; i += MAX_FOTOS_POR_CHAMADA) {
    const grupo = fotos.slice(i, i + MAX_FOTOS_POR_CHAMADA);
    const partesComId: { id: string; part: ReturnType<typeof createPartFromBase64> }[] = [];

    for (const foto of grupo) {
      try {
        const res = await fetch(foto.thumbnailUrl, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const base64 = Buffer.from(buf).toString("base64");
        partesComId.push({ id: foto.id, part: createPartFromBase64(base64, "image/jpeg") });
      } catch {
        continue;
      }
    }
    if (partesComId.length === 0) continue;

    const prompt =
      `Você está avaliando ${partesComId.length} fotos de um empreendimento imobiliário pra ` +
      `decidir quais mostrar na página pública de vendas, na ordem em que aparecem abaixo ` +
      `(foto 1, foto 2, ...). Pra CADA foto, devolva: um score de 0 a 100 (qualidade visual + ` +
      `quão vendável/atrativa é pra um comprador em potencial), uma legenda curta em português ` +
      `descrevendo o que ela mostra, e uma categoria — exatamente uma entre "fachada" (área ` +
      `externa/prédio/vista), "lazer" (piscina, academia, salão de festas, áreas comuns), ` +
      `"planta" (planta baixa/desenho técnico do imóvel) ou "outro" (nenhuma das anteriores, ` +
      `ex.: interior de apartamento, detalhe de acabamento). Responda em JSON: um array com ` +
      `exatamente ${partesComId.length} objeto(s), na mesma ordem, cada um {"score": number, ` +
      `"legenda": string, "categoria": "fachada"|"lazer"|"planta"|"outro"}.`;

    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: createUserContent([
          createPartFromText(prompt),
          ...partesComId.map((p) => p.part),
        ]),
        config: { responseMimeType: "application/json" },
      });

      const parsed = JSON.parse(response.text ?? "[]") as {
        score: number;
        legenda: string;
        categoria: string;
      }[];
      if (!Array.isArray(parsed)) continue;

      const categoriasValidas: CategoriaFoto[] = ["fachada", "lazer", "planta", "outro"];
      partesComId.forEach((p, idx) => {
        const item = parsed[idx];
        if (item) {
          const categoria = categoriasValidas.includes(item.categoria as CategoriaFoto)
            ? (item.categoria as CategoriaFoto)
            : "outro";
          resultados.push({
            id: p.id,
            score: Number(item.score) || 0,
            legenda: String(item.legenda ?? ""),
            categoria,
          });
        }
      });
    } catch {
      // Falha segura: um grupo de fotos que não pôde ser avaliado (JSON
      // malformado, erro de rede) não impede o restante — essas fotos
      // simplesmente ficam sem score_ia, revisáveis manualmente depois.
      continue;
    }
  }

  return resultados;
}

export type UnidadeExtraida = {
  bloco: string | null;
  andar: number | null;
  numero: string;
  tipo_planta: string | null;
  area: number | null;
  preco: number | null;
};

export type GrupoExtraido = { nome_empreendimento: string; unidades: UnidadeExtraida[] };

// Uma única tabela de preços em PDF pode cobrir VÁRIOS empreendimentos ao
// mesmo tempo (achado real: "Tabela Atualizada" do GMV.incorporadora) —
// por isso o resultado vem agrupado por nome, e quem chama esta função é
// responsável por casar cada grupo com o lote certo (nome mais parecido).
export async function extrairTabelaPdf(
  pdfBytes: ArrayBuffer,
  nomesConhecidos: string[],
): Promise<GrupoExtraido[]> {
  const ai = getAI();
  const base64 = Buffer.from(pdfBytes).toString("base64");

  const contextoNomes =
    nomesConhecidos.length > 1
      ? `Ele pode cobrir MAIS DE UM empreendimento ao mesmo tempo — os nomes conhecidos são: ${nomesConhecidos.join(", ")}. Agrupe as unidades encontradas por qual desses nomes elas pertencem (use o nome mais parecido possível; se não conseguir identificar com confiança, use "não identificado").`
      : `Ele cobre o empreendimento "${nomesConhecidos[0] ?? "desconhecido"}".`;

  const prompt =
    `Este PDF é uma tabela de preços de empreendimento(s) imobiliário(s). ${contextoNomes} ` +
    `Pra cada unidade extraia: bloco (se houver), andar (se houver, número), numero ` +
    `(identificador da unidade), tipo_planta (se houver), area (m², número), preco (em reais, ` +
    `só número, sem formatação). Responda em JSON: {"grupos": [{"nome_empreendimento": string, ` +
    `"unidades": [{"bloco": string|null, "andar": number|null, "numero": string, ` +
    `"tipo_planta": string|null, "area": number|null, "preco": number|null}]}]}. Se não conseguir ` +
    `extrair nenhuma unidade, responda {"grupos": []}.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: createUserContent([
        createPartFromText(prompt),
        createPartFromBase64(base64, "application/pdf"),
      ]),
      config: { responseMimeType: "application/json" },
    });
    const parsed = JSON.parse(response.text ?? "{}") as { grupos?: GrupoExtraido[] };
    return parsed.grupos ?? [];
  } catch {
    return [];
  }
}

function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Casamento por substring nos dois sentidos — simples, mas suficiente pro
// dado real do GMV (ex.: "Telavive" extraído casa com o lote "Residencial
// Telavive" via substring).
export function nomesCorrespondem(nomeExtraido: string, nomeLote: string): boolean {
  const a = normalizarNome(nomeExtraido);
  const b = normalizarNome(nomeLote);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}
