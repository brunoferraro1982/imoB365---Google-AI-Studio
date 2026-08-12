// Fase 2 do Assistente de importação de construtoras: extração best-effort
// de um imóvel a partir do HTML do anúncio no site da construtora.
//
// Estratégia (mesma filosofia da captação via Chaves na Mão em captacao.ts):
// preferir dado ESTRUTURADO já servido pra SEO/rich-snippets —
// <script type="application/ld+json"> (schema.org RealEstateListing/Product/
// Residence/Offer) e depois OpenGraph (og:*/product:*) — antes de qualquer
// heurística frágil. Se o estruturado não trouxer os campos-chave, o servidor
// cai pro Gemini lendo o texto visível (ver extrairImovelDeTexto em
// construtoraIngestaoAI.ts). SEMPRE com revisão humana antes de publicar.
//
// Este módulo é PURO (sem I/O de banco, sem segredo) de propósito — o `fetch`
// e a orquestração do fallback de IA ficam no server fn; aqui só entra HTML e
// sai dado normalizado, o que deixa a lógica de parsing testável isoladamente.

export type ImovelExtraido = {
  titulo: string | null;
  preco: number | null;
  area_total: number | null;
  area_util: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  descricao: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_bairro: string | null;
  endereco_logradouro: string | null;
  // texto livre — o wizard mapeia pro <select> de tipo/finalidade na revisão.
  tipo: string | null;
  finalidade: string | null;
};

export type ExtracaoUrlResult = {
  dados: ImovelExtraido;
  imagens: string[];
  // De onde cada bloco de dado veio — pra UI dizer honestamente ao super_admin
  // o quanto foi estruturado vs. precisa de conferência.
  origens: ("jsonld" | "og" | "img")[];
  // Texto visível da página (limpo), pro fallback de IA no server fn.
  textoVisivel: string;
};

function vazio(): ImovelExtraido {
  return {
    titulo: null,
    preco: null,
    area_total: null,
    area_util: null,
    quartos: null,
    suites: null,
    banheiros: null,
    vagas: null,
    descricao: null,
    endereco_cidade: null,
    endereco_uf: null,
    endereco_bairro: null,
    endereco_logradouro: null,
    tipo: null,
    finalidade: null,
  };
}

// Parser de número no formato brasileiro (e também no formato "cru" de
// schema.org, que costuma ser ponto-decimal). Lida com "R$ 1.250.000,00",
// "120,5", "42 m²", "1.250.000", "120.5", "3 quartos".
export function parseNumeroBR(raw: unknown): number | null {
  if (raw == null) return null;
  const m = String(raw).match(/-?[\d.,]+/);
  if (!m) return null;
  let s = m[0];
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // ponto = milhar, vírgula = decimal (padrão BR)
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    // "1.250.000" (vários pontos) ou "1.250" (grupo de 3) = milhar; senão decimal
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, "");
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseInteiro(raw: unknown): number | null {
  const n = parseNumeroBR(raw);
  return n == null ? null : Math.round(n);
}

// Achata @graph e arrays em uma lista plana de nós JSON-LD.
function coletarNosJsonLd(html: string): Record<string, unknown>[] {
  const nos: Record<string, unknown>[] = [];
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of matches) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const empilhar = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(empilhar);
      else if (v && typeof v === "object") {
        const obj = v as Record<string, unknown>;
        nos.push(obj);
        if (Array.isArray(obj["@graph"])) (obj["@graph"] as unknown[]).forEach(empilhar);
      }
    };
    empilhar(parsed);
  }
  return nos;
}

const TIPOS_IMOVEL_JSONLD = new Set([
  "realestatelisting",
  "product",
  "residence",
  "apartment",
  "house",
  "singlefamilyresidence",
  "accommodation",
  "offer",
  "place",
]);

function tipoDoNo(no: Record<string, unknown>): string {
  const t = no["@type"];
  if (Array.isArray(t)) return String(t[0] ?? "").toLowerCase();
  return String(t ?? "").toLowerCase();
}

function textoDe(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return textoDe(o.name ?? o["@value"] ?? o.value ?? null);
  }
  return null;
}

function precoDeOffers(no: Record<string, unknown>): number | null {
  const offers = no.offers as Record<string, unknown> | undefined;
  const cand =
    no.price ??
    offers?.price ??
    (offers?.priceSpecification as Record<string, unknown> | undefined)?.price ??
    (Array.isArray(offers) ? (offers[0] as Record<string, unknown>)?.price : undefined);
  return parseNumeroBR(cand);
}

function extrairDeJsonLd(html: string, dados: ImovelExtraido): boolean {
  const nos = coletarNosJsonLd(html);
  const no = nos.find((n) => TIPOS_IMOVEL_JSONLD.has(tipoDoNo(n)));
  if (!no) return false;

  let usou = false;
  const set = <K extends keyof ImovelExtraido>(k: K, v: ImovelExtraido[K]) => {
    if (v != null && v !== "" && dados[k] == null) {
      dados[k] = v;
      usou = true;
    }
  };

  set("titulo", textoDe(no.name));
  set("descricao", textoDe(no.description));
  set("preco", precoDeOffers(no));

  const floorSize = no.floorSize as Record<string, unknown> | undefined;
  set("area_total", parseNumeroBR(floorSize?.value ?? floorSize?.unitText ?? no.floorSize));
  set("quartos", parseInteiro(no.numberOfRooms ?? no.numberOfBedrooms));
  set("banheiros", parseInteiro(no.numberOfBathroomsTotal ?? no.numberOfBathrooms));
  set(
    "vagas",
    parseInteiro((no.amenityFeature as Record<string, unknown> | undefined)?.value ?? undefined),
  );

  const addr = no.address as Record<string, unknown> | undefined;
  if (addr && typeof addr === "object") {
    set("endereco_logradouro", textoDe(addr.streetAddress));
    set("endereco_bairro", textoDe(addr.addressNeighborhood ?? addr.neighborhood));
    set("endereco_cidade", textoDe(addr.addressLocality));
    const uf = textoDe(addr.addressRegion);
    set("endereco_uf", uf ? uf.slice(0, 2).toUpperCase() : null);
  }
  return usou;
}

function extrairMeta(html: string, prop: string): string[] {
  const out: string[] = [];
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop.replace(/[:]/g, "\\$&")}["'][^>]*>`,
    "gi",
  );
  for (const tag of html.matchAll(re)) {
    const c = tag[0].match(/content=["']([^"']*)["']/i);
    if (c && c[1]) out.push(c[1].trim());
  }
  return out;
}

function extrairDeOpenGraph(html: string, dados: ImovelExtraido): boolean {
  let usou = false;
  const set = <K extends keyof ImovelExtraido>(k: K, v: ImovelExtraido[K]) => {
    if (v != null && v !== "" && dados[k] == null) {
      dados[k] = v;
      usou = true;
    }
  };
  set("titulo", extrairMeta(html, "og:title")[0] ?? null);
  set("descricao", extrairMeta(html, "og:description")[0] ?? null);
  set("preco", parseNumeroBR(extrairMeta(html, "product:price:amount")[0] ?? null));
  return usou;
}

function resolverUrl(src: string, base: string): string | null {
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

// Padrões que quase nunca são a foto do imóvel (ícones, logos, sprites,
// pixels de rastreamento, badges). Evita encher a revisão de lixo.
const IMG_IGNORAR =
  /(sprite|logo|icon|favicon|pixel|placeholder|avatar|badge|whatsapp|facebook|instagram|selo|banner-?ad|\.svg($|\?))/i;

const MAX_IMAGENS = 15;

function imagensDeJsonLd(html: string): string[] {
  const out: string[] = [];
  for (const no of coletarNosJsonLd(html)) {
    const img = no.image;
    const push = (v: unknown) => {
      if (typeof v === "string") out.push(v);
      else if (v && typeof v === "object") {
        const u = (v as Record<string, unknown>).url;
        if (typeof u === "string") out.push(u);
      }
    };
    if (Array.isArray(img)) img.forEach(push);
    else push(img);
  }
  return out;
}

export function extrairImagens(html: string, baseUrl: string): string[] {
  const brutas = [
    ...extrairMeta(html, "og:image"),
    ...extrairMeta(html, "og:image:secure_url"),
    ...imagensDeJsonLd(html),
  ];
  // <img> da página como reforço (capado) — só src plausível de foto grande.
  for (const tag of html.matchAll(/<img[^>]+>/gi)) {
    const src =
      tag[0].match(/(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i)?.[1] ??
      tag[0].match(/(?:data-srcset|srcset)=["']([^"'\s]+)/i)?.[1];
    if (src) brutas.push(src);
  }

  const vistas = new Set<string>();
  const out: string[] = [];
  for (const bruta of brutas) {
    if (!bruta || bruta.startsWith("data:")) continue;
    if (IMG_IGNORAR.test(bruta)) continue;
    const abs = resolverUrl(bruta, baseUrl);
    if (!abs || vistas.has(abs)) continue;
    vistas.add(abs);
    out.push(abs);
    if (out.length >= MAX_IMAGENS) break;
  }
  return out;
}

export function textoVisivel(html: string, max = 6000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// Ponto de entrada puro: HTML → dado estruturado + imagens + texto pro fallback.
export function extrairImovelDeHtml(html: string, url: string): ExtracaoUrlResult {
  const dados = vazio();
  const origens: ("jsonld" | "og" | "img")[] = [];
  if (extrairDeJsonLd(html, dados)) origens.push("jsonld");
  if (extrairDeOpenGraph(html, dados)) origens.push("og");
  const imagens = extrairImagens(html, url);
  if (imagens.length > 0) origens.push("img");
  return { dados, imagens, origens, textoVisivel: textoVisivel(html) };
}
