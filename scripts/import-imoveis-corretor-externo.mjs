#!/usr/bin/env node
// Sincroniza o portfólio de um corretor autônomo a partir do site externo
// dele pra dentro da imob365 — só cria os imóveis que ainda NÃO existem
// (diff por codigo_interno), nunca duplica nem apaga nada.
//
// Nasceu de um caso real (corretora Daniela Fonseca,
// danielafonsecaimoveis.com.br, plataforma "Eu Corretor"/Odoo) e foi
// generalizado pra qualquer corretor/site parecido — não é exclusivo dessa
// plataforma: qualquer site que emita JSON-LD schema.org
// (Product/Accommodation, RealEstateListing) numa página de detalhe por
// imóvel funciona, é um padrão web comum entre CRMs imobiliários
// brasileiros, não uma peculiaridade do Eu Corretor.
//
// Como funciona:
// 1. Pagina o catálogo público (--catalogo-path) coletando todo link que
//    bate com --listing-regex (por padrão, o formato .../id-<numero> do Eu
//    Corretor — ajuste pra outro site se o formato do link for diferente).
// 2. Busca os codigo_interno já existentes pro tenant na imob365 (REST) e
//    calcula a diferença — só os novos seguem adiante.
// 3. Pra cada novo, baixa a página de detalhe, extrai o bloco JSON-LD
//    (@graph → item Product/Accommodation) e monta o registro do imóvel.
// 4. Insere em `imoveis` (rascunho já publicado, status=ativo — mesmo
//    padrão da importação original) e baixa+reenvia cada foto pro bucket
//    `imovel-fotos` (nunca hotlinka fotos de fora).
//
// Uso (precisa de SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no ambiente —
// nunca comitar essas chaves; rodar direto na VPS de produção via
// `node --env-file=/opt/imob365/app/.env` reaproveita a chave que o
// próprio app já tem configurada, sem precisar trazer pra máquina local):
//
//   node scripts/import-imoveis-corretor-externo.mjs \
//     --tenant-id=<uuid> \
//     --dominio=danielafonsecaimoveis.com.br \
//     [--corretor-id=<uuid>]        # se omitido, resolve sozinho quando o
//                                   # tenant tem exatamente 1 corretor
//     [--catalogo-path=/buscar-imovel]
//     [--listing-regex='\\/imoveis\\/[^"]*-id-(\\d+)']
//     [--dry-run]                  # só mostra o que seria importado
//     [--plataforma=univen]        # sites Univen (cdn uso.com.br): sem JSON-LD,
//                                  # lê o HTML da ficha — catálogo em /imoveis/pagina-N/
//     [--sem-corretor]             # tenant sem cadastro em `corretores`: importa
//                                  # com corretor_responsavel_id nulo
//     [--teste]                    # importa só o 1º novo (validar antes do lote)
//     [--somente-extrair[=N]]      # não toca no banco: só lê o site e imprime os
//                                  # N primeiros imóveis extraídos (default 3)
//
// Exemplo Univen (corretora Carina Mello, carinamelloprime.com.br):
//   node --env-file=/opt/imob365/app/.env scripts/import-imoveis-corretor-externo.mjs \
//     --plataforma=univen --dominio=carinamelloprime.com.br \
//     --tenant-id=<uuid> --sem-corretor --teste

import { readFileSync } from "node:fs";

function loadEnvFile() {
  try {
    const text = readFileSync(".env", "utf8");
    const env = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed
        .slice(idx + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    args[key] = rest.length ? rest.join("=") : true;
  }
  return args;
}

const fileEnv = loadEnvFile();
const SUPABASE_URL = process.env.SUPABASE_URL ?? fileEnv.SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY;

const args = parseArgs(process.argv.slice(2));
const TENANT_ID = args["tenant-id"];
const DOMINIO = args["dominio"];
const DRY_RUN = args["dry-run"] === true;
const PLATAFORMA = args["plataforma"] ?? "eucorretor";
const SEM_CORRETOR = args["sem-corretor"] === true;
const TESTE = args["teste"] === true;
const SOMENTE_EXTRAIR =
  args["somente-extrair"] === undefined
    ? 0
    : args["somente-extrair"] === true
      ? 3
      : Number(args["somente-extrair"]);
const CATALOGO_PATH = args["catalogo-path"] ?? "/buscar-imovel";
const LISTING_REGEX = new RegExp(args["listing-regex"] ?? '\\/imoveis\\/[^"]*-id-(\\d+)', "g");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

if (!["eucorretor", "univen"].includes(PLATAFORMA)) {
  console.error(`Erro: --plataforma deve ser eucorretor ou univen (veio "${PLATAFORMA}").`);
  process.exit(1);
}
if (!SOMENTE_EXTRAIR && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error("Erro: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes (env ou .env).");
  process.exit(1);
}
if ((!TENANT_ID && !SOMENTE_EXTRAIR) || !DOMINIO) {
  console.error(
    "Uso: node scripts/import-imoveis-corretor-externo.mjs --tenant-id=<uuid> --dominio=<host> [--corretor-id=<uuid>] [--dry-run]",
  );
  process.exit(1);
}

const TIPO_MAP = {
  apartamento: "apartamento",
  casa: "casa",
  cobertura: "cobertura",
  sobrado: "sobrado",
  flat: "flat",
  kitnet: "kitnet",
  terreno: "terreno",
  sitio: "sitio",
  chacara: "chacara",
  fazenda: "fazenda",
};

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function supabaseRest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  return res;
}

async function resolverCorretorId() {
  if (args["corretor-id"]) return args["corretor-id"];
  if (SEM_CORRETOR) return null;
  const res = await supabaseRest(`corretores?tenant_id=eq.${TENANT_ID}&select=id&limit=2`);
  const rows = await res.json();
  if (!res.ok) throw new Error(`Falha ao buscar corretores: ${JSON.stringify(rows)}`);
  if (rows.length !== 1) {
    throw new Error(
      `--corretor-id não informado e o tenant tem ${rows.length} corretor(es) — informe explicitamente (ou --sem-corretor).`,
    );
  }
  return rows[0].id;
}

async function codigosExistentes() {
  const res = await supabaseRest(
    `imoveis?tenant_id=eq.${TENANT_ID}&select=codigo_interno&codigo_interno=not.is.null`,
  );
  const rows = await res.json();
  if (!res.ok) throw new Error(`Falha ao buscar imóveis existentes: ${JSON.stringify(rows)}`);
  return new Set(rows.map((r) => r.codigo_interno));
}

async function listarHrefsCatalogo() {
  const hrefs = new Map(); // codigo -> href completo
  for (let page = 1; ; page++) {
    const url = `https://${DOMINIO}${CATALOGO_PATH}?page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) break;
    const html = await res.text();
    const antes = hrefs.size;
    for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
      const href = m[1];
      const codigoMatch = href.match(LISTING_REGEX);
      if (codigoMatch) {
        const codigo = href.match(/-(\d+)$/)?.[1] ?? codigoMatch[0];
        hrefs.set(codigo, href);
      }
    }
    if (hrefs.size === antes) break; // página sem nada novo — fim da paginação
  }
  return hrefs;
}

async function fetchDetalhe(href) {
  const url = `https://${DOMINIO}${href}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const html = await res.text();

  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ldMatch) throw new Error(`JSON-LD não encontrado em ${url}`);
  const data = JSON.parse(ldMatch[1]);
  const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
  const prop = graph.find((g) =>
    ["Product", "Accommodation", "RealEstateListing"].some((t) => String(g["@type"]).includes(t)),
  );
  if (!prop) throw new Error(`Item de imóvel não encontrado no JSON-LD de ${url}`);

  const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/);
  const metaDesc = metaDescMatch ? metaDescMatch[1] : "";
  const vagasMatch = metaDesc.match(/(\d+)\s*vagas?\s*de\s*garagem/i);

  const tipoSlug = href.match(/\/imoveis\/([a-z-]+)/)?.[1]?.split("-")[0] ?? "";

  return {
    codigoInterno: String(prop.identifier?.value ?? href.match(/-(\d+)$/)?.[1] ?? ""),
    titulo: prop.name,
    descricao: prop.description ?? null,
    finalidade: /loca[cç][aã]o|aluguel/i.test(prop.category ?? "") ? "aluguel" : "venda",
    tipo: TIPO_MAP[tipoSlug] ?? "outro",
    preco: prop.offers?.price ?? 0,
    quartos: prop.numberOfBedrooms ?? null,
    banheiros: prop.numberOfBathroomsTotal ?? null,
    vagas: vagasMatch ? Number(vagasMatch[1]) : null,
    areaUtil: prop.floorSize?.value ?? null,
    bairro: prop.address?.streetAddress ?? null,
    cidade: prop.address?.addressLocality ?? null,
    uf: prop.address?.addressRegion ?? null,
    aceitaFinanciamento: /financi[aá]vel/i.test(prop.description ?? ""),
    aceitaPermuta: /aceita permuta/i.test(prop.description ?? ""),
    fotos: prop.image ?? [],
    urlOrigem: url,
  };
}

// ---------------------------------------------------------------------------
// Plataforma Univen (sites com CDN cdn*.uso.com.br, ex.: carinamelloprime.com.br)
// Não emite JSON-LD — a ficha é lida pelas classes estáveis do template:
// .valor-imovel (Venda/Locação), .referencia, .icone_nome (Dormitórios,
// Suítes…), #texto-descricao, .alinha_valores (Condomínio/IPTU),
// .todos_itens (características). Fotos: as da galeria do próprio imóvel,
// que vêm ANTES do bloco "Imóveis semelhantes" (miniaturas de outros imóveis).

const UNIVEN_HREF_RE = /^\/(comprar|alugar|comprar-ou-alugar)\/[a-z]{2}\/[^"?#]+\/(\d+)\/?$/;

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const textoLimpo = (html) =>
  decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();

/** "R$ 298.000,00" → 298000 */
function moeda(str) {
  if (!str) return null;
  const n = Number(
    String(str)
      .replace(/[^\d,]/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "55,00 m²" → 55 */
function numero(str) {
  if (!str) return null;
  const n = Number(
    String(str)
      .replace(/[^\d,.]/g, "")
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : null;
}

/** "Canto Do Forte" → "Canto do Forte" */
function nomeProprio(str) {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && ["do", "da", "de", "dos", "das", "e"].includes(w)
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

async function listarHrefsUniven() {
  const hrefs = new Map(); // id do site -> href
  for (let page = 1; page <= 100; page++) {
    const url = `https://${DOMINIO}/imoveis/pagina-${page}/`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) break;
    const html = await res.text();
    const antes = hrefs.size;
    for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
      const href = m[1].replace(/\/$/, "");
      const mm = href.match(UNIVEN_HREF_RE);
      if (mm) hrefs.set(mm[2], href);
    }
    if (hrefs.size === antes) break;
  }
  return hrefs;
}

async function fetchDetalheUniven(href) {
  const url = `https://${DOMINIO}${href}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const html = await res.text();
  const codigoSite = href.match(UNIVEN_HREF_RE)?.[2];

  const titulo = textoLimpo(html.match(/<h1[^>]*class="titulo"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  if (!titulo) throw new Error(`Título não encontrado em ${url}`);

  // "Canto Do Forte - Praia Grande/SP"
  const loc = textoLimpo(
    html.match(/<h2[^>]*class="localizacao"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "",
  );
  const [bairroRaw, cidadeUf = ""] = loc.split(/\s+-\s+/);
  const [cidadeRaw, uf] = cidadeUf.split("/");

  const valores = {};
  for (const m of html.matchAll(
    /<div class="valor-imovel[^"]*"><h3>([^<]+)<\/h3><h4>([^<]+)<\/h4>/g,
  )) {
    valores[m[1].trim().toLowerCase()] = moeda(m[2]);
  }
  const precoVenda = valores["venda"] ?? null;
  const precoLocacao = valores["locação"] ?? valores["locacao"] ?? null;

  const referencia =
    html
      .match(/class="referencia"><span>Refer[êe]ncia:\s*<\/span><span>([^<]+)<\/span>/)?.[1]
      ?.trim() ?? null;

  const det = {};
  for (const m of html.matchAll(
    /<div class="icone_nome"><span[^>]*>([^<]+)<\/span><span>([^<]*)<\/span><\/div>/g,
  )) {
    det[m[1].trim().toLowerCase()] = m[2].trim();
  }

  const descHtml = html.match(/<div id="texto-descricao"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
  // O site troca emojis por "?" — vira marcador de lista
  const descricao =
    textoLimpo(descHtml)
      .replace(/(^|\s)\?\s+/g, "$1• ")
      .replace(/\s*•\s/g, "\n• ")
      .trim() || null;

  const condominio = moeda(html.match(/<small>Condom[íi]nio<\/small><span>([^<]+)<\/span>/)?.[1]);
  const iptu = moeda(
    html.match(/<small>IPTU(?:<small>[^<]*<\/small>)?<\/small><span>([^<]+)<\/span>/)?.[1],
  );

  const itensHtml =
    html.match(/<div class="todos_itens">([\s\S]*?)<div class="semelhantes/)?.[1] ?? "";
  const caracteristicas = [
    ...new Set(
      [...itensHtml.matchAll(/<div class="item_unico">[\s\S]*?<span>([^<]+)<\/span>/g)].map((m) =>
        decodeEntities(m[1]).trim(),
      ),
    ),
  ].filter(Boolean);

  const corte = html.indexOf('id="semelhantes_imoveis"');
  const galeria = corte > 0 ? html.slice(0, corte) : html;
  const fotos = [
    ...new Set(
      [
        ...galeria.matchAll(
          /https?:\/\/cdn\d*\.uso\.com\.br\/\d+\/[^"'\s)]+?\.(?:jpe?g|png|webp)/gi,
        ),
      ]
        .map((m) => m[0])
        .filter((u) => !/\/mini_/.test(u)),
    ),
  ];

  const tipoSlug = href.split("/")[5] ?? "";
  return {
    codigoInterno: String(codigoSite),
    titulo,
    descricao,
    finalidade: precoVenda ? "venda" : precoLocacao ? "aluguel" : "venda",
    tipo: TIPO_MAP[tipoSlug] ?? "outro",
    preco: precoVenda ?? precoLocacao ?? 0,
    quartos: numero(det["dormitórios"] ?? det["quartos"]),
    suites: numero(det["suítes"]),
    banheiros: numero(det["banheiros"]),
    vagas: numero(det["vagas"]),
    areaUtil: numero(det["área útil"] ?? det["área privativa"]),
    areaTotal: numero(det["área total"] ?? det["área construída"]),
    bairro: bairroRaw ? nomeProprio(bairroRaw) : null,
    cidade: cidadeRaw ? nomeProprio(cidadeRaw) : null,
    uf: uf?.trim().toUpperCase() ?? null,
    condominio,
    iptu,
    caracteristicas,
    aceitaFinanciamento: /financi/i.test(descricao ?? ""),
    aceitaPermuta: /permuta/i.test(descricao ?? ""),
    fotos,
    urlOrigem: url,
    customData: {
      importado_de: url,
      referencia_origem: referencia,
      ...(precoVenda && precoLocacao ? { preco_locacao: precoLocacao } : {}),
      ...(iptu ? { iptu_periodicidade: "mensal" } : {}),
    },
  };
}

const listarCatalogo = () =>
  PLATAFORMA === "univen" ? listarHrefsUniven() : listarHrefsCatalogo();
const extrairDetalhe = (href) =>
  PLATAFORMA === "univen" ? fetchDetalheUniven(href) : fetchDetalhe(href);

async function insertImovel(corretorId, data) {
  const slug = `${slugify(data.titulo)}-${data.codigoInterno}`;
  const payload = {
    tenant_id: TENANT_ID,
    corretor_responsavel_id: corretorId,
    codigo_interno: data.codigoInterno,
    titulo: data.titulo,
    slug,
    descricao: data.descricao,
    finalidade: data.finalidade,
    tipo: data.tipo,
    status: "ativo",
    publicado: true,
    publicado_em: new Date().toISOString(),
    preco: data.preco,
    area_util: data.areaUtil,
    quartos: data.quartos,
    banheiros: data.banheiros,
    vagas: data.vagas,
    endereco_bairro: data.bairro,
    endereco_cidade: data.cidade,
    endereco_uf: data.uf,
    aceita_financiamento: data.aceitaFinanciamento,
    aceita_permuta: data.aceitaPermuta,
    // Campos que só algumas plataformas trazem (Univen) — omitidos se ausentes
    ...(data.suites != null && { suites: data.suites }),
    ...(data.areaTotal != null && { area_total: data.areaTotal }),
    ...(data.condominio != null && { condominio: data.condominio }),
    ...(data.iptu != null && { iptu: data.iptu }),
    ...(data.caracteristicas?.length && { caracteristicas: data.caracteristicas }),
    ...(data.customData && { custom_data: data.customData }),
  };
  const res = await supabaseRest("imoveis", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Insert imoveis falhou: ${res.status} ${JSON.stringify(json)}`);
  return json[0];
}

async function uploadFoto(imovelId, imageUrl, ordem) {
  const imgRes = await fetch(imageUrl, { headers: { "User-Agent": UA } });
  if (!imgRes.ok) throw new Error(`Falha ao baixar foto ${imageUrl}: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `${TENANT_ID}/${imovelId}/${crypto.randomUUID()}.${ext}`;

  const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/imovel-fotos/${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": contentType,
    },
    body: buf,
  });
  if (!upRes.ok) throw new Error(`Falha ao subir foto: ${upRes.status} ${await upRes.text()}`);

  const fotoRes = await supabaseRest("imovel_fotos", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      imovel_id: imovelId,
      tenant_id: TENANT_ID,
      storage_path: path,
      ordem,
      capa: ordem === 0,
    }),
  });
  if (!fotoRes.ok)
    throw new Error(`Falha ao inserir imovel_fotos: ${fotoRes.status} ${await fotoRes.text()}`);
}

async function main() {
  console.log(
    `Plataforma: ${PLATAFORMA} — catálogo: https://${DOMINIO}${PLATAFORMA === "univen" ? "/imoveis/pagina-N/" : CATALOGO_PATH}`,
  );
  const hrefsAtuais = await listarCatalogo();
  console.log(`${hrefsAtuais.size} imóveis encontrados no site externo.`);

  if (SOMENTE_EXTRAIR) {
    for (const [, href] of [...hrefsAtuais.entries()].slice(0, SOMENTE_EXTRAIR)) {
      const { descricao, fotos, ...resto } = await extrairDetalhe(href);
      console.log(
        JSON.stringify(
          { ...resto, descricao: descricao?.slice(0, 160), fotos: fotos.length, foto1: fotos[0] },
          null,
          2,
        ),
      );
    }
    return;
  }

  const existentes = await codigosExistentes();
  const novos = [...hrefsAtuais.entries()].filter(([codigo]) => !existentes.has(codigo));
  console.log(`${existentes.size} já existem na imob365 — ${novos.length} novo(s) a importar.`);
  if (novos.length === 0) return;

  if (DRY_RUN) {
    for (const [codigo, href] of novos) console.log(`  [dry-run] +${codigo} ${href}`);
    return;
  }

  const corretorId = await resolverCorretorId();
  const resultados = [];
  const erros = [];
  const fila = TESTE ? novos.slice(0, 1) : novos;
  if (TESTE) console.log("Modo --teste: importando só 1 imóvel.");
  for (const [, href] of fila) {
    console.log(`\n=== ${href} ===`);
    try {
      const data = await extrairDetalhe(href);
      console.log(`  ${data.titulo} — R$${data.preco} — ${data.fotos.length} fotos`);
      const imovel = await insertImovel(corretorId, data);
      console.log(`  -> criado ${imovel.id} (slug=${imovel.slug})`);
      let ok = 0;
      for (let i = 0; i < data.fotos.length; i++) {
        try {
          await uploadFoto(imovel.id, data.fotos[i], i);
          ok++;
        } catch (e) {
          console.error(`  foto ${i} falhou: ${e.message}`);
        }
      }
      console.log(`  -> ${ok}/${data.fotos.length} fotos enviadas`);
      resultados.push(imovel);
    } catch (e) {
      console.error(`FALHOU ${href}: ${e.message}`);
      erros.push({ href, erro: e.message });
    }
  }
  console.log(`\n=== RESUMO: ${resultados.length}/${fila.length} imóveis criados ===`);
  if (erros.length) console.log("ERROS:", JSON.stringify(erros, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
