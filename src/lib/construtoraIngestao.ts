// Ingestão automatizada de empreendimentos/imóveis a partir de fontes
// externas de uma construtora parceira (caso real: GMV divulga lançamentos
// e revendas via Linktree, cujos links apontam pra pastas do Google Drive
// com fotos/plantas/vídeos e tabelas de preço em PDF). Genérico por
// construtora — GMV é só o primeiro caso de uso real, não está hardcoded
// aqui. Usado tanto pela rota /api/public/cron/construtora-ingestao
// (service role, todas as construtoras) quanto pelo botão "Sincronizar
// agora" (server function autenticada) via
// src/lib/construtoraIngestao.functions.ts. Espelha a arquitetura de
// src/lib/captacao.ts (watermark de execução, dedupe por UNIQUE).
//
// Confirmado via fetch real (curl) contra os 3 links do GMV citados pelo
// usuário: cada página Linktree embute um <script id="__NEXT_DATA__"> com
// todos os links da página em JSON estruturado — fetch simples + parse de
// JSON basta, não precisa de browser headless. A página também injeta uma
// porção de links de afiliado/anúncio (thanks.is, kqzyfj.com,
// click.linksynergy.com, sjv.io, etc.), por isso os links descobertos são
// filtrados por allowlist de domínio (só linktr.ee e drive.google.com
// interessam aqui — o resto é descartado, nunca vira mídia candidata).

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface ConstrutoraIngestaoClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export type TipoMidia =
  | "foto_fachada"
  | "foto_lazer"
  | "foto_planta"
  | "video"
  | "pdf_tabela"
  | "outro";

type LinkBruto = { titulo: string; url: string };

function isLinktreeUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("linktr.ee");
  } catch {
    return false;
  }
}

// O Drive às vezes gera o link de pasta com um segmento extra "/u/<N>/"
// (conta logada em outra aba/perfil, ex.: drive.google.com/drive/u/4/folders/...)
// em vez do padrão "drive/folders/..." puro — achado real testando contra
// revendasgmv (4 das 7 pastas usavam essa variante, silenciosamente
// ignoradas até este fix).
function isDriveFolderUrl(url: string): boolean {
  return /drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(url);
}

function isDriveFileUrl(url: string): boolean {
  return /drive\.google\.com\/file\/d\//.test(url);
}

function extractDriveId(url: string): string | null {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/) ?? url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Heurística por título do link Linktree (nome da pasta/arquivo tal como
// divulgado, ex.: "Perspectivas", "Lazer", "Plantas", "Vídeo", "Tabela
// Atualizada") — não depende de IA pra essa parte, só string matching.
function classificarPorTitulo(titulo: string): TipoMidia {
  const t = titulo.toLowerCase();
  if (t.includes("planta")) return "foto_planta";
  if (t.includes("lazer")) return "foto_lazer";
  if (t.includes("perspectiva") || t.includes("fachada")) return "foto_fachada";
  if (t.includes("vídeo") || t.includes("video")) return "video";
  if (t.includes("tabela") || t.includes("e-book") || t.includes("ebook")) return "pdf_tabela";
  return "outro";
}

function classificarPorMime(mimeType: string): TipoMidia | null {
  if (mimeType === "application/pdf") return "pdf_tabela";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return null; // deixa o título da pasta decidir (fachada/lazer/planta)
  return "outro";
}

// Extrai todo {title,url} do JSON embutido, recursivamente — a estrutura
// exata do __NEXT_DATA__ do Linktree não é documentada/versionada
// publicamente, então caminhar por qualquer objeto com essas duas chaves é
// mais robusto que confiar num caminho fixo dentro do JSON.
export async function crawlLinktree(url: string): Promise<LinkBruto[]> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return [];

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const encontrados: LinkBruto[] = [];
  const vistos = new Set<string>();

  function walk(node: unknown) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const linkUrl = typeof obj.url === "string" ? obj.url : null;
      const titulo = typeof obj.title === "string" ? obj.title.trim() : "";
      if (
        linkUrl &&
        (isLinktreeUrl(linkUrl) || isDriveFolderUrl(linkUrl) || isDriveFileUrl(linkUrl))
      ) {
        if (!vistos.has(linkUrl)) {
          vistos.add(linkUrl);
          encontrados.push({ titulo: titulo || linkUrl, url: linkUrl });
        }
      }
      for (const value of Object.values(obj)) walk(value);
    }
  }

  walk(data);
  return encontrados;
}

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export type ArquivoDrive = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
};

function driveApiKey(): string {
  const key = process.env.GOOGLE_DRIVE_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_DRIVE_API_KEY não configurada — necessária pra listar/baixar conteúdo do Google Drive.",
    );
  }
  return key;
}

export async function listarPastaDrive(folderId: string): Promise<ArquivoDrive[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,thumbnailLink)",
    pageSize: "100",
    key: driveApiKey(),
  });
  const res = await fetch(`${DRIVE_API_BASE}/files?${params}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { files?: ArquivoDrive[] };
  return json.files ?? [];
}

export async function obterArquivoDrive(fileId: string): Promise<ArquivoDrive | null> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,thumbnailLink",
    key: driveApiKey(),
  });
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}?${params}`);
  if (!res.ok) return null;
  return (await res.json()) as ArquivoDrive;
}

export async function baixarArquivoDrive(fileId: string): Promise<ArrayBuffer | null> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media&key=${driveApiKey()}`);
  if (!res.ok) return null;
  return res.arrayBuffer();
}

const BATCH_SIZE_FONTES = 20;

export type ProcessarIngestaoOpcoes = {
  construtoraId?: string;
  forcar?: boolean;
};

export type ProcessarIngestaoResult = {
  fontesProcessadas: number;
  lotesNovos: number;
  lotesAtualizados: number;
  midiasEncontradas: number;
};

async function upsertMidia(
  client: ConstrutoraIngestaoClient,
  loteId: string,
  driveId: string,
  tipo: TipoMidia,
  thumbnailUrl: string | null,
): Promise<boolean> {
  const { error } = await client
    .from("construtora_ingestao_midias")
    .upsert(
      { lote_id: loteId, origem_drive_id: driveId, tipo, thumbnail_url: thumbnailUrl },
      { onConflict: "lote_id,origem_drive_id", ignoreDuplicates: true },
    );
  return !error;
}

export async function processarIngestao(
  client: ConstrutoraIngestaoClient,
  opcoes: ProcessarIngestaoOpcoes = {},
): Promise<ProcessarIngestaoResult> {
  const nowIso = new Date().toISOString();

  let query = client
    .from("construtora_fontes_ingestao")
    .select("*")
    .eq("ativo", true)
    .order("ultima_execucao", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE_FONTES);
  if (opcoes.construtoraId) query = query.eq("construtora_id", opcoes.construtoraId);
  const { data: fontes } = await query;

  let fontesProcessadas = 0;
  let lotesNovos = 0;
  let lotesAtualizados = 0;
  let midiasEncontradas = 0;

  for (const fonte of (fontes ?? []) as Record<string, unknown>[]) {
    const intervaloHoras = (fonte.intervalo_horas as number) ?? 24;
    const ultimaExecucao = fonte.ultima_execucao as string | null;
    if (!opcoes.forcar && ultimaExecucao) {
      const proximaExecucao = new Date(ultimaExecucao).getTime() + intervaloHoras * 3600_000;
      if (proximaExecucao > Date.now()) continue;
    }

    fontesProcessadas++;
    const fonteId = fonte.id as string;
    const construtoraId = fonte.construtora_id as string;
    const fonteUrl = fonte.url as string;

    const linksTopo = await crawlLinktree(fonteUrl);

    // Cada sub-hub Linktree (ex.: gmvpredios2 -> sub-página por lançamento)
    // ou pasta do Drive linkada direto (ex.: GMV.incorporadora,
    // revendasgmv) define UM lote. Arquivos do Drive linkados soltos no
    // topo (ex.: "Tabela Atualizada") não têm nome de lote próprio — viram
    // mídia compartilhada, anexada a todos os lotes descobertos nesta
    // mesma passada (é exatamente o padrão real do GMV.incorporadora: 1
    // PDF cobrindo vários lançamentos ao mesmo tempo).
    type CandidatoLote = { titulo: string; url: string; midiasDiretas: LinkBruto[] };
    const candidatosLote: CandidatoLote[] = [];
    const pdfsCompartilhados: LinkBruto[] = [];

    for (const link of linksTopo) {
      if (isLinktreeUrl(link.url)) {
        const subLinks = await crawlLinktree(link.url);
        candidatosLote.push({
          titulo: link.titulo,
          url: link.url,
          midiasDiretas: subLinks.filter((l) => !isLinktreeUrl(l.url)),
        });
      } else if (isDriveFolderUrl(link.url)) {
        candidatosLote.push({ titulo: link.titulo, url: link.url, midiasDiretas: [link] });
      } else if (isDriveFileUrl(link.url)) {
        pdfsCompartilhados.push(link);
      }
      // outros domínios (visualizador 3D, Instagram, site institucional) —
      // deliberadamente ignorados, viram só link de referência na página
      // Linktree, não são ingeridos.
    }

    for (const candidato of candidatosLote) {
      const { data: loteExistente } = await client
        .from("construtora_ingestao_lotes")
        .select("id")
        .eq("fonte_id", fonteId)
        .eq("nome_bruto", candidato.titulo)
        .maybeSingle();

      let loteId: string;
      if (loteExistente) {
        loteId = loteExistente.id as string;
        await client
          .from("construtora_ingestao_lotes")
          .update({ status: "coletando", link_origem: candidato.url })
          .eq("id", loteId);
        lotesAtualizados++;
      } else {
        const { data: novoLote } = await client
          .from("construtora_ingestao_lotes")
          .insert({
            fonte_id: fonteId,
            construtora_id: construtoraId,
            nome_bruto: candidato.titulo,
            link_origem: candidato.url,
            status: "coletando",
          })
          .select("id")
          .single();
        loteId = novoLote.id as string;
        lotesNovos++;
      }

      const todasMidias = [...candidato.midiasDiretas, ...pdfsCompartilhados];
      try {
        for (const midia of todasMidias) {
          const driveId = extractDriveId(midia.url);
          if (!driveId) continue;

          if (isDriveFolderUrl(midia.url)) {
            const arquivos = await listarPastaDrive(driveId);
            const tipoPasta = classificarPorTitulo(midia.titulo);
            for (const arquivo of arquivos) {
              const tipoFinal = classificarPorMime(arquivo.mimeType) ?? tipoPasta;
              if (
                await upsertMidia(
                  client,
                  loteId,
                  arquivo.id,
                  tipoFinal,
                  arquivo.thumbnailLink ?? null,
                )
              ) {
                midiasEncontradas++;
              }
            }
          } else {
            const arquivo = await obterArquivoDrive(driveId);
            const tipo = arquivo
              ? (classificarPorMime(arquivo.mimeType) ?? classificarPorTitulo(midia.titulo))
              : classificarPorTitulo(midia.titulo);
            if (await upsertMidia(client, loteId, driveId, tipo, arquivo?.thumbnailLink ?? null)) {
              midiasEncontradas++;
            }
          }
        }

        await client
          .from("construtora_ingestao_lotes")
          .update({ status: "pronto_revisao", erro_mensagem: null })
          .eq("id", loteId);
      } catch (err) {
        // Um lote com erro (ex.: GOOGLE_DRIVE_API_KEY ausente, pasta sem
        // compartilhamento público, rate limit) não pode abortar os demais
        // lotes/fontes do mesmo ciclo — cada lote falha isoladamente,
        // registrado pra diagnóstico, mesmo espírito de captacao.ts (nunca
        // deixar um erro silencioso nem deixar um erro isolado derrubar o
        // lote inteiro).
        await client
          .from("construtora_ingestao_lotes")
          .update({
            status: "erro",
            erro_mensagem: err instanceof Error ? err.message : String(err),
          })
          .eq("id", loteId);
      }
    }

    await client
      .from("construtora_fontes_ingestao")
      .update({ ultima_execucao: nowIso })
      .eq("id", fonteId);
  }

  return { fontesProcessadas, lotesNovos, lotesAtualizados, midiasEncontradas };
}
