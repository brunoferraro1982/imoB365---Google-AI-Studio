import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  processarIngestao,
  baixarArquivoDrive,
  obterArquivoDrive,
  DRIVE_TIMEOUT_MS,
} from "@/lib/construtoraIngestao";
import { extrairImovelDeHtml, type ImovelExtraido } from "@/lib/construtoraUrlExtract";
import { extrairImovelDeTexto } from "@/lib/construtoraIngestaoAI";

// Botão "Sincronizar agora" (tela de ingestão dentro de /admin/construtoras):
// força o processamento das fontes de uma construtora ignorando o gate de
// intervalo_horas — mesmo motor do cron diário (processarIngestao), mas com
// service role (supabaseAdmin) porque construtora_ingestao_midias só tem
// policy de escrita pra super_admin/robô (ver
// supabase/migrations/20260730100000_construtora_ingestao.sql). Como isso
// contorna a RLS, checamos super_admin explicitamente aqui, sem depender
// dela — mesmo padrão de src/lib/captacao.functions.ts.
//
// Achado real em produção: o ciclo completo (crawl + Drive + Gemini) leva
// 20-25+ minutos pro dataset real do GMV — bem além do proxy_read_timeout
// do nginx (504 Gateway Time-out reproduzido ao vivo) e do timeout padrão
// do próprio servidor HTTP do Node. Fica errado tentar esticar timeout de
// proxy pra uma dezena de minutos (trava conexão, não sobrevive a reload
// de página, etc.) — a correção certa é não esperar a sincronização
// terminar dentro da requisição: dispara em segundo plano (fire-and-forget,
// o processo Node continua rodando normalmente depois da resposta, já que
// isso roda num servidor persistente via systemd, não serverless) e
// responde na hora. O progresso passa a ser visto reabrindo a construtora
// depois (ultima_execucao/lotes/mídias já vão atualizando conforme cada
// fonte é processada).
export const sincronizarIngestaoAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { construtora_id: string }) =>
    z.object({ construtora_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) {
      throw new Error("Sem permissão para sincronizar ingestão de construtoras.");
    }

    processarIngestao(supabaseAdmin, { construtoraId: data.construtora_id, forcar: true }).catch(
      (err) => {
        console.error("[construtoraIngestao] sincronização manual falhou em segundo plano:", err);
      },
    );

    return { iniciado: true };
  });

// A thumbnailLink que a Drive API devolve é uma URL assinada de validade
// curtíssima (achado real: expira em segundos, não em horas — o valor
// gravado em construtora_ingestao_midias no momento da coleta é usado ali
// mesmo, na mesma sincronização, pra pontuação da IA, mas já não serve pra
// exibir na tela de revisão depois) e além disso é hospedada em
// lh3.googleusercontent.com — hotlinkar direto num <img src> do navegador
// também esbarra em rate-limit por IP/referer do lado do Google, então nem
// pedir um link fresco e devolver a URL crua pro navegador é confiável.
// Por isso o próprio servidor baixa os bytes do thumbnail (usando o link
// fresco só internamente, na mesma chamada) e devolve como data URI —
// o navegador nunca faz nenhuma requisição direta ao Google.
export const obterThumbnailsFrescos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ midiaIds: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirSuperAdmin(supabase, userId);

    if (data.midiaIds.length === 0) return [];
    // origem_url é coluna nova (Fase 2), ainda não em types.ts — cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: midias } = await (supabaseAdmin as any)
      .from("construtora_ingestao_midias")
      .select("id,origem_drive_id,origem_url")
      .in("id", data.midiaIds);

    return Promise.all(
      (
        (midias ?? []) as {
          id: string;
          origem_drive_id: string | null;
          origem_url: string | null;
        }[]
      ).map(async (m) => {
        try {
          if (m.origem_drive_id) {
            const info = await obterArquivoDrive(m.origem_drive_id);
            if (!info?.thumbnailLink) return { id: m.id, thumbnailUrl: null as string | null };
            const res = await fetch(info.thumbnailLink, {
              signal: AbortSignal.timeout(DRIVE_TIMEOUT_MS),
            });
            if (!res.ok) return { id: m.id, thumbnailUrl: null };
            const buf = await res.arrayBuffer();
            const base64 = Buffer.from(buf).toString("base64");
            const mime = res.headers.get("content-type") || "image/jpeg";
            return { id: m.id, thumbnailUrl: `data:${mime};base64,${base64}` };
          }
          if (m.origem_url) {
            // Baixa a imagem externa no servidor e devolve como data URI —
            // o navegador nunca hotlinka o site da construtora direto
            // (mesma política do thumbnail do Drive: evita rate-limit/referer).
            const baixado = await baixarBytesDeUrl(m.origem_url);
            if (!baixado) return { id: m.id, thumbnailUrl: null };
            const base64 = Buffer.from(baixado.bytes).toString("base64");
            return { id: m.id, thumbnailUrl: `data:${baixado.mime};base64,${base64}` };
          }
          return { id: m.id, thumbnailUrl: null };
        } catch {
          return { id: m.id, thumbnailUrl: null };
        }
      }),
    );
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exigirSuperAdmin(supabase: any, userId: string): Promise<void> {
  const { data: isSuper } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!isSuper) {
    throw new Error("Sem permissão para revisar lotes de ingestão.");
  }
}

function slugifyLote(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const UnidadeSchema = z.object({
  bloco: z.string().nullable().optional(),
  andar: z.number().nullable().optional(),
  numero: z.string(),
  tipo_planta: z.string().nullable().optional(),
  area: z.number().nullable().optional(),
  preco: z.number().nullable().optional(),
});

const DestinoSchema = z.object({
  tenantId: z.string().uuid(),
  corretorId: z.string().uuid().nullable().optional(),
});

// Copia as fotos aprovadas do Drive (resolução real, não o thumbnail usado
// só pra pontuação) pro bucket público imovel-fotos — só as efetivamente
// selecionadas na revisão, nunca todo o lote. Retorna as public URLs, na
// mesma ordem de midiaIds, pulando silenciosamente qualquer uma que falhar
// no download (não trava a aprovação inteira por uma foto problemática).
async function copiarMidiasParaBucket(
  midias: { id: string; origem_drive_id: string | null; origem_url?: string | null }[],
  storagePrefix: string,
): Promise<{ midiaId: string; path: string; publicUrl: string }[]> {
  const resultado: { midiaId: string; path: string; publicUrl: string }[] = [];
  for (const midia of midias) {
    try {
      let bytes: ArrayBuffer | null = null;
      let mime = "image/jpeg";
      if (midia.origem_drive_id) {
        // Origem 'linktree' — foto no Google Drive (resolução real).
        const [info, driveBytes] = await Promise.all([
          obterArquivoDrive(midia.origem_drive_id),
          baixarArquivoDrive(midia.origem_drive_id),
        ]);
        bytes = driveBytes;
        mime = info?.mimeType || "image/jpeg";
      } else if (midia.origem_url) {
        // Origem 'url' (Fase 2) — imagem externa do anúncio da construtora.
        const baixado = await baixarBytesDeUrl(midia.origem_url);
        if (baixado) {
          bytes = baixado.bytes;
          mime = baixado.mime;
        }
      }
      if (!bytes) continue;
      const ext = EXT_POR_MIME[mime] || "jpg";
      const path = `${storagePrefix}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("imovel-fotos")
        .upload(path, Buffer.from(bytes), { contentType: mime, cacheControl: "3600" });
      if (upErr) continue;
      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("imovel-fotos").getPublicUrl(path);
      resultado.push({ midiaId: midia.id, path, publicUrl });
    } catch {
      // Falha isolada numa foto (download, upload) não impede as demais.
      continue;
    }
  }
  return resultado;
}

// Baixa os bytes de uma imagem por URL externa (mídia de origem 'url' da Fase
// 2). Timeout explícito — mesmo cuidado do fetch do Drive/Gemini (um servidor
// lento pendurado não pode travar a aprovação inteira).
const URL_IMG_TIMEOUT_MS = 15000;
const URL_IMG_MAX_BYTES = 15 * 1024 * 1024;
async function baixarBytesDeUrl(url: string): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(URL_IMG_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; imob365-import/1.0)" },
    });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!mime.startsWith("image/")) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > URL_IMG_MAX_BYTES) return null;
    return { bytes, mime };
  } catch {
    return null;
  }
}

// Coloca a foto de capa escolhida em primeiro — assim `capa=true` (imóvel) e
// `fotos_urls[0]` (empreendimento) apontam pra ela sem lógica extra. Se não
// houver capa escolhida (ou ela não estiver entre as copiadas), mantém a ordem.
function ordenarComCapaPrimeiro<T extends { midiaId: string }>(
  copiadas: T[],
  capaMidiaId: string | null | undefined,
): T[] {
  if (!capaMidiaId) return copiadas;
  const idx = copiadas.findIndex((c) => c.midiaId === capaMidiaId);
  if (idx <= 0) return copiadas;
  return [copiadas[idx], ...copiadas.slice(0, idx), ...copiadas.slice(idx + 1)];
}

// Aprova um lote pra um ou mais destinos ao mesmo tempo (imobiliária e/ou
// corretor individual) — cada destino selecionado vira um rascunho
// independente (empreendimento ou imóvel avulso, conforme tipo_alvo da
// fonte), já com as fotos escolhidas na revisão, mas SEMPRE
// publicado=false — quem decide publicar é o fluxo normal já existente em
// /app/empreendimentos ou /app/imoveis, nunca este endpoint. Preços/
// unidades extraídos por IA (dados_extraidos) são só o ponto de partida —
// o super_admin edita antes de aprovar (unidades vêm já editadas do
// client, não são relidas de dados_extraidos aqui).
//
// Um destino falhando (ex.: tenant inválido) não impede os demais — cada
// um roda isolado, e o resultado por destino volta na resposta pra UI
// reportar exatamente o que deu certo/errado. Não bloqueia reaprovar um
// lote já aprovado antes: o pedido explícito foi poder atribuir a MAIS
// destinos depois, não só na primeira aprovação — só o par exato
// (tenant+corretor) já usado antes é que fica bloqueado, pela constraint
// de unicidade de construtora_ingestao_aprovacoes.
export const aprovarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        loteId: z.string().uuid(),
        // Tipo escolhido pelo super_admin na revisão — sobrescreve o
        // tipo_alvo herdado da fonte (achado real: nem todo lote de uma
        // fonte "Lançamento" é de fato um empreendimento com várias
        // unidades, ex. "Residencial Telavive" era 1 imóvel avulso).
        tipoAlvo: z.enum(["empreendimento", "imovel"]),
        destinos: z.array(DestinoSchema).min(1),
        midiaIds: z.array(z.string().uuid()),
        // Foto de capa escolhida na revisão (item 4 do wizard). Se ausente,
        // cai no comportamento antigo (primeira foto copiada = capa).
        capaMidiaId: z.string().uuid().nullable().optional(),
        // Publicar imediatamente (aparece no site do destino) em vez de criar
        // como rascunho. Default false — o comportamento seguro/histórico da
        // pipeline é sempre criar rascunho pro destino revisar antes. O wizard
        // expõe isso como um opt-in explícito no passo Publicar.
        publicar: z.boolean().optional(),
        nome: z.string().min(1),
        unidades: z.array(UnidadeSchema).optional(),
        // Conjunto completo de campos do imóvel (paridade com /app/imoveis/novo).
        // finalidade/tipo são enums no banco — passados só quando informados
        // (senão vale o default do insert).
        imovel: z
          .object({
            finalidade: z.string().nullable().optional(),
            tipo: z.string().nullable().optional(),
            preco: z.number().nullable().optional(),
            condominio: z.number().nullable().optional(),
            iptu: z.number().nullable().optional(),
            area_total: z.number().nullable().optional(),
            area_util: z.number().nullable().optional(),
            quartos: z.number().nullable().optional(),
            suites: z.number().nullable().optional(),
            banheiros: z.number().nullable().optional(),
            vagas: z.number().nullable().optional(),
            endereco_cidade: z.string().nullable().optional(),
            endereco_uf: z.string().nullable().optional(),
            endereco_bairro: z.string().nullable().optional(),
            endereco_logradouro: z.string().nullable().optional(),
            descricao: z.string().nullable().optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirSuperAdmin(supabase, userId);

    const { data: lote, error: loteErr } = await supabaseAdmin
      .from("construtora_ingestao_lotes")
      .select("id,fonte_id,construtora_id,status")
      .eq("id", data.loteId)
      .maybeSingle();
    if (loteErr || !lote) throw new Error("Lote não encontrado.");

    const tipoAlvo = data.tipoAlvo;

    // origem_url é coluna nova (Fase 2), ainda não em types.ts — cast pra o
    // select não quebrar o tsc, mesmo padrão já usado nesta feature.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: midiasSelecionadas } = await (supabaseAdmin as any)
      .from("construtora_ingestao_midias")
      .select("id,origem_drive_id,origem_url")
      .in(
        "id",
        data.midiaIds.length > 0 ? data.midiaIds : ["00000000-0000-0000-0000-000000000000"],
      );

    // Checa destinos já aprovados ANTES de criar qualquer rascunho — achado
    // real testando: sem esse check, tentar aprovar o mesmo destino duas
    // vezes criava um empreendimento/imóvel órfão (a constraint de
    // unicidade só barra depois, no insert em construtora_ingestao_aprovacoes,
    // quando o rascunho duplicado já foi criado).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: aprovacoesExistentes } = await (supabaseAdmin as any)
      .from("construtora_ingestao_aprovacoes")
      .select("tenant_id,corretor_id")
      .eq("lote_id", data.loteId);
    const jaAprovado = new Set(
      (aprovacoesExistentes ?? []).map(
        (a: { tenant_id: string; corretor_id: string | null }) =>
          `${a.tenant_id}:${a.corretor_id ?? ""}`,
      ),
    );

    const resultados: {
      tenantId: string;
      corretorId: string | null;
      empreendimentoId: string | null;
      imovelId: string | null;
      erro?: string;
    }[] = [];
    let ultimoEmpreendimentoId: string | null = null;
    let ultimoImovelId: string | null = null;
    const publicado = data.publicar === true;

    for (const destino of data.destinos) {
      if (jaAprovado.has(`${destino.tenantId}:${destino.corretorId ?? ""}`)) {
        resultados.push({
          tenantId: destino.tenantId,
          corretorId: destino.corretorId ?? null,
          empreendimentoId: null,
          imovelId: null,
          erro: "Este lote já foi aprovado pra este destino.",
        });
        continue;
      }
      let empreendimentoId: string | null = null;
      let imovelId: string | null = null;
      try {
        if (tipoAlvo === "empreendimento") {
          const { data: emp, error: empErr } = await supabaseAdmin
            .from("empreendimentos")
            .insert({
              tenant_id: destino.tenantId,
              nome: data.nome,
              slug: slugifyLote(data.nome),
              construtora_id: lote.construtora_id,
              publicado,
              fotos_urls: [],
            })
            .select("id")
            .single();
          if (empErr || !emp) throw new Error(empErr?.message ?? "Erro ao criar empreendimento.");
          empreendimentoId = emp.id;

          const copiadas = ordenarComCapaPrimeiro(
            await copiarMidiasParaBucket(
              midiasSelecionadas ?? [],
              `${destino.tenantId}/emp-${emp.id}`,
            ),
            data.capaMidiaId,
          );
          if (copiadas.length > 0) {
            await supabaseAdmin
              .from("empreendimentos")
              .update({ fotos_urls: copiadas.map((c) => c.publicUrl) })
              .eq("id", emp.id);
            for (const c of copiadas) {
              await supabaseAdmin
                .from("construtora_ingestao_midias")
                .update({ storage_path: c.path, aprovada: true })
                .eq("id", c.midiaId);
            }
          }

          for (const u of data.unidades ?? []) {
            await supabaseAdmin.from("empreendimento_unidades").insert({
              empreendimento_id: emp.id,
              tenant_id: destino.tenantId,
              numero: u.numero,
              bloco: u.bloco ?? null,
              andar: u.andar ?? null,
              tipo_planta: u.tipo_planta ?? null,
              area: u.area ?? null,
              preco: u.preco ?? null,
            });
          }
        } else {
          const im = data.imovel ?? {};
          const { data: imovel, error: imovelErr } = await supabaseAdmin
            .from("imoveis")
            .insert({
              tenant_id: destino.tenantId,
              titulo: data.nome,
              slug: slugifyLote(data.nome),
              publicado,
              corretor_responsavel_id: destino.corretorId ?? undefined,
              // finalidade/tipo são enums — passados só quando informados
              // (senão vale o default do banco).
              finalidade: (im.finalidade ?? undefined) as never,
              tipo: (im.tipo ?? undefined) as never,
              preco: im.preco ?? undefined,
              condominio: im.condominio ?? undefined,
              iptu: im.iptu ?? undefined,
              area_total: im.area_total ?? undefined,
              area_util: im.area_util ?? undefined,
              quartos: im.quartos ?? undefined,
              suites: im.suites ?? undefined,
              banheiros: im.banheiros ?? undefined,
              vagas: im.vagas ?? undefined,
              endereco_cidade: im.endereco_cidade ?? undefined,
              endereco_uf: im.endereco_uf ?? undefined,
              endereco_bairro: im.endereco_bairro ?? undefined,
              endereco_logradouro: im.endereco_logradouro ?? undefined,
              descricao: im.descricao ?? undefined,
            })
            .select("id")
            .single();
          if (imovelErr || !imovel) throw new Error(imovelErr?.message ?? "Erro ao criar imóvel.");
          imovelId = imovel.id;

          const copiadas = ordenarComCapaPrimeiro(
            await copiarMidiasParaBucket(
              midiasSelecionadas ?? [],
              `${destino.tenantId}/${imovel.id}`,
            ),
            data.capaMidiaId,
          );
          for (let i = 0; i < copiadas.length; i++) {
            const c = copiadas[i];
            await supabaseAdmin.from("imovel_fotos").insert({
              imovel_id: imovel.id,
              tenant_id: destino.tenantId,
              storage_path: c.path,
              ordem: i,
              capa: i === 0,
            });
            await supabaseAdmin
              .from("construtora_ingestao_midias")
              .update({ storage_path: c.path, aprovada: true })
              .eq("id", c.midiaId);
          }
        }

        // construtora_ingestao_aprovacoes ainda não está em types.ts (tabela
        // nova, requer regenerar os tipos) — mesmo cast já usado em outros
        // pontos do projeto pra tabela nova sem regeneração de tipos ainda.
        const { error: aprovacaoErr } = await (supabaseAdmin as any)
          .from("construtora_ingestao_aprovacoes")
          .insert({
            lote_id: data.loteId,
            tenant_id: destino.tenantId,
            corretor_id: destino.corretorId ?? null,
            empreendimento_id: empreendimentoId,
            imovel_id: imovelId,
            aprovado_por: userId,
          });

        resultados.push({
          tenantId: destino.tenantId,
          corretorId: destino.corretorId ?? null,
          empreendimentoId,
          imovelId,
          erro: aprovacaoErr?.message,
        });
        ultimoEmpreendimentoId = empreendimentoId ?? ultimoEmpreendimentoId;
        ultimoImovelId = imovelId ?? ultimoImovelId;
      } catch (err) {
        resultados.push({
          tenantId: destino.tenantId,
          corretorId: destino.corretorId ?? null,
          empreendimentoId,
          imovelId,
          erro: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    // tipo_alvo_override ainda não está em types.ts (coluna nova, requer
    // regenerar os tipos) — mesmo cast já usado nesta feature pra tabela/
    // coluna nova sem regeneração de tipos ainda.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("construtora_ingestao_lotes")
      .update({
        status: "aprovado",
        // Fica gravado como escolha definitiva do lote (não só desta
        // submissão) — se o mesmo lote for aprovado de novo depois pra
        // mais destinos, reabre já com o mesmo tipo escolhido aqui.
        tipo_alvo_override: tipoAlvo,
        empreendimento_id: ultimoEmpreendimentoId,
        imovel_id: ultimoImovelId,
        revisado_por: userId,
        revisado_em: new Date().toISOString(),
      })
      .eq("id", data.loteId);

    return { resultados };
  });

export const rejeitarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ loteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirSuperAdmin(supabase, userId);

    await supabaseAdmin
      .from("construtora_ingestao_lotes")
      .update({
        status: "rejeitado",
        revisado_por: userId,
        revisado_em: new Date().toISOString(),
      })
      .eq("id", data.loteId);

    return { ok: true };
  });

// ───────────────────────── Fase 2 — extração por URL ─────────────────────────

const URL_HTML_TIMEOUT_MS = 20000;
const URL_HTML_MAX_BYTES = 5 * 1024 * 1024;

// Fonte SINTÉTICA por construtora pros imports por link avulso: ativo=false
// (o cron processarIngestao só varre ativo=true, então nunca a re-sincroniza)
// e origem='url' (a UI a esconde da lista de fontes periódicas). Reaproveitada
// entre todos os imports por URL da mesma construtora. Get-or-create.
async function obterOuCriarFonteUrl(construtoraId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any;
  const { data: existente } = await admin
    .from("construtora_fontes_ingestao")
    .select("id")
    .eq("construtora_id", construtoraId)
    .eq("origem", "url")
    .maybeSingle();
  if (existente?.id) return existente.id as string;

  const { data: nova, error } = await admin
    .from("construtora_fontes_ingestao")
    .insert({
      construtora_id: construtoraId,
      nome: "Importações por link",
      url: "(interno) importações por link de anúncio",
      tipo_alvo: "imovel",
      ativo: false,
      origem: "url",
    })
    .select("id")
    .single();
  if (error || !nova) throw new Error(error?.message ?? "Falha ao preparar a fonte de importação.");
  return nova.id as string;
}

function nomeDoLote(dados: ImovelExtraido, url: string): string {
  if (dados.titulo && dados.titulo.trim()) return dados.titulo.trim().slice(0, 160);
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.slice(0, 160);
  } catch {
    return url.slice(0, 160);
  }
}

// Extrai um imóvel a partir do LINK do anúncio no site da construtora e cria
// um lote pronto_revisao — que cai na MESMA revisão da Fase 1 no wizard. Nunca
// publica sozinho. Estruturado (JSON-LD/OG) primeiro; IA (Gemini) só preenche
// o que faltou. As imagens ficam como URLs externas (origem_url) até serem
// efetivamente copiadas pro bucket na aprovação.
export const extrairImovelDeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        construtoraId: z.string().uuid(),
        url: z.string().url().max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirSuperAdmin(supabase, userId);

    // 1) Baixa o HTML do anúncio (timeout + cap de tamanho + User-Agent de
    //    navegador — vários sites bloqueiam UA vazio).
    let html: string;
    try {
      const res = await fetch(data.url, {
        signal: AbortSignal.timeout(URL_HTML_TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) throw new Error(`A página respondeu ${res.status}.`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength > URL_HTML_MAX_BYTES) throw new Error("Página grande demais.");
      html = new TextDecoder("utf-8").decode(buf);
    } catch (err) {
      throw new Error(
        `Não consegui ler a página: ${err instanceof Error ? err.message : "erro"}. ` +
          `Confira o link ou preencha os dados manualmente na revisão.`,
      );
    }

    // 2) Extração estruturada (pura) + fallback de IA só pro que faltou.
    const { dados, imagens, origens, textoVisivel } = extrairImovelDeHtml(html, data.url);
    let usouIA = false;
    const faltaChave = dados.preco == null && dados.area_total == null && dados.quartos == null;
    if (faltaChave) {
      const ia = await extrairImovelDeTexto(textoVisivel);
      usouIA =
        ia.preco != null ||
        ia.area_total != null ||
        ia.quartos != null ||
        ia.descricao != null ||
        ia.tipo != null;
      dados.preco ??= ia.preco ?? null;
      dados.area_total ??= ia.area_total ?? null;
      dados.quartos ??= ia.quartos ?? null;
      dados.suites ??= ia.suites ?? null;
      dados.banheiros ??= ia.banheiros ?? null;
      dados.vagas ??= ia.vagas ?? null;
      dados.descricao ??= ia.descricao ?? null;
      dados.tipo ??= ia.tipo ?? null;
      dados.endereco_cidade ??= ia.endereco_cidade ?? null;
      dados.endereco_uf ??= ia.endereco_uf ?? null;
      dados.endereco_bairro ??= ia.endereco_bairro ?? null;
    }

    // 3) Persiste como lote pronto_revisao (dedupe por link_origem).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const fonteId = await obterOuCriarFonteUrl(data.construtoraId);

    const { data: loteExistente } = await admin
      .from("construtora_ingestao_lotes")
      .select("id")
      .eq("fonte_id", fonteId)
      .eq("link_origem", data.url)
      .maybeSingle();

    const nome = nomeDoLote(dados, data.url);
    let loteId: string;
    if (loteExistente?.id) {
      loteId = loteExistente.id as string;
      await admin
        .from("construtora_ingestao_lotes")
        .update({ nome_bruto: nome, status: "pronto_revisao", dados_extraidos: dados })
        .eq("id", loteId);
      // Re-extração: descarta as imagens externas antigas (não as já copiadas
      // pro bucket, essas têm storage_path e não são deste caminho).
      await admin
        .from("construtora_ingestao_midias")
        .delete()
        .eq("lote_id", loteId)
        .not("origem_url", "is", null);
    } else {
      // nome_bruto tem UNIQUE(fonte_id, nome_bruto) — se colidir com outro
      // anúncio de mesmo título, desambigua com sufixo curto.
      let tentativa = nome;
      let inserido: { id: string } | null = null;
      for (let i = 0; i < 3 && !inserido; i++) {
        const { data: novo, error } = await admin
          .from("construtora_ingestao_lotes")
          .insert({
            fonte_id: fonteId,
            construtora_id: data.construtoraId,
            nome_bruto: tentativa,
            link_origem: data.url,
            status: "pronto_revisao",
            dados_extraidos: dados,
          })
          .select("id")
          .single();
        if (novo) inserido = novo;
        else if (error?.code === "23505")
          tentativa = `${nome} (${Math.random().toString(36).slice(2, 5)})`;
        else throw new Error(error?.message ?? "Falha ao criar o lote.");
      }
      if (!inserido) throw new Error("Falha ao criar o lote (nome duplicado).");
      loteId = inserido.id;
    }

    // 4) Grava as imagens como mídias de origem_url (recomendadas = já
    //    pré-selecionadas na revisão; a primeira vira capa/fachada).
    if (imagens.length > 0) {
      await admin.from("construtora_ingestao_midias").insert(
        imagens.map((u, i) => ({
          lote_id: loteId,
          tipo: i === 0 ? "foto_fachada" : "outro",
          origem_url: u,
          recomendada: true,
        })),
      );
    }

    return {
      loteId,
      titulo: nome,
      camposComValor: Object.values(dados).filter((v) => v != null && v !== "").length,
      imagens: imagens.length,
      origens: usouIA ? [...origens, "ia" as const] : origens,
    };
  });
