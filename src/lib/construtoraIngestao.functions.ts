import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  processarIngestao,
  baixarArquivoDrive,
  obterArquivoDrive,
} from "@/lib/construtoraIngestao";

// Botão "Sincronizar agora" (tela de ingestão dentro de /admin/construtoras):
// força o processamento das fontes de uma construtora ignorando o gate de
// intervalo_horas — mesmo motor do cron diário (processarIngestao), mas com
// service role (supabaseAdmin) porque construtora_ingestao_midias só tem
// policy de escrita pra super_admin/robô (ver
// supabase/migrations/20260730100000_construtora_ingestao.sql). Como isso
// contorna a RLS, checamos super_admin explicitamente aqui, sem depender
// dela — mesmo padrão de src/lib/captacao.functions.ts.
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

    return processarIngestao(supabaseAdmin, { construtoraId: data.construtora_id, forcar: true });
  });

// A thumbnailLink que a Drive API devolve é uma URL assinada de curta
// duração — o valor gravado em construtora_ingestao_midias no momento da
// coleta (usado ali mesmo, na mesma sincronização, pra pontuação da IA)
// expira bem antes do super_admin abrir a tela de revisão depois (achado
// real: link testado horas depois voltava 403, um pedido novo à Drive API
// pro mesmo arquivo devolve link fresco e funcional). Por isso a tela de
// revisão nunca usa o thumbnail_url salvo pra exibir a imagem — sempre
// busca um link fresco sob demanda, só quando o lote é aberto.
export const obterThumbnailsFrescos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ midiaIds: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirSuperAdmin(supabase, userId);

    if (data.midiaIds.length === 0) return [];
    const { data: midias } = await supabaseAdmin
      .from("construtora_ingestao_midias")
      .select("id,origem_drive_id")
      .in("id", data.midiaIds);

    return Promise.all(
      (midias ?? []).map(async (m) => {
        if (!m.origem_drive_id) return { id: m.id, thumbnailUrl: null as string | null };
        try {
          const info = await obterArquivoDrive(m.origem_drive_id);
          return { id: m.id, thumbnailUrl: info?.thumbnailLink ?? null };
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

// Copia as fotos aprovadas do Drive (resolução real, não o thumbnail usado
// só pra pontuação) pro bucket público imovel-fotos — só as efetivamente
// selecionadas na revisão, nunca todo o lote. Retorna as public URLs, na
// mesma ordem de midiaIds, pulando silenciosamente qualquer uma que falhar
// no download (não trava a aprovação inteira por uma foto problemática).
async function copiarMidiasParaBucket(
  midias: { id: string; origem_drive_id: string | null }[],
  storagePrefix: string,
): Promise<{ midiaId: string; path: string; publicUrl: string }[]> {
  const resultado: { midiaId: string; path: string; publicUrl: string }[] = [];
  for (const midia of midias) {
    if (!midia.origem_drive_id) continue;
    try {
      const [info, bytes] = await Promise.all([
        obterArquivoDrive(midia.origem_drive_id),
        baixarArquivoDrive(midia.origem_drive_id),
      ]);
      if (!bytes) continue;
      const ext = (info && EXT_POR_MIME[info.mimeType]) || "jpg";
      const path = `${storagePrefix}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("imovel-fotos")
        .upload(path, Buffer.from(bytes), {
          contentType: info?.mimeType || "image/jpeg",
          cacheControl: "3600",
        });
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

// Aprova um lote: cria o rascunho real (empreendimento ou imóvel avulso,
// conforme tipo_alvo da fonte) já com as fotos escolhidas na revisão, mas
// SEMPRE publicado=false — quem decide publicar é o fluxo normal já
// existente em /app/empreendimentos ou /app/imoveis, nunca este endpoint.
// Preços/unidades extraídos por IA (dados_extraidos) são só o ponto de
// partida — o super_admin edita antes de aprovar (unidades vêm já
// editadas do client, não são relidas de dados_extraidos aqui).
export const aprovarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        loteId: z.string().uuid(),
        tenantId: z.string().uuid(),
        midiaIds: z.array(z.string().uuid()),
        nome: z.string().min(1),
        unidades: z.array(UnidadeSchema).optional(),
        imovel: z
          .object({
            preco: z.number().nullable().optional(),
            area_total: z.number().nullable().optional(),
            quartos: z.number().nullable().optional(),
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
    if (lote.status === "aprovado") throw new Error("Este lote já foi aprovado.");

    const { data: fonte } = await supabaseAdmin
      .from("construtora_fontes_ingestao")
      .select("tipo_alvo")
      .eq("id", lote.fonte_id)
      .maybeSingle();
    const tipoAlvo = (fonte?.tipo_alvo as "empreendimento" | "imovel") ?? "empreendimento";

    const { data: midiasSelecionadas } = await supabaseAdmin
      .from("construtora_ingestao_midias")
      .select("id,origem_drive_id")
      .in(
        "id",
        data.midiaIds.length > 0 ? data.midiaIds : ["00000000-0000-0000-0000-000000000000"],
      );

    let empreendimentoId: string | null = null;
    let imovelId: string | null = null;

    if (tipoAlvo === "empreendimento") {
      const { data: emp, error: empErr } = await supabaseAdmin
        .from("empreendimentos")
        .insert({
          tenant_id: data.tenantId,
          nome: data.nome,
          slug: slugifyLote(data.nome),
          construtora_id: lote.construtora_id,
          publicado: false,
          fotos_urls: [],
        })
        .select("id")
        .single();
      if (empErr || !emp) throw new Error(empErr?.message ?? "Erro ao criar empreendimento.");
      empreendimentoId = emp.id;

      const copiadas = await copiarMidiasParaBucket(
        midiasSelecionadas ?? [],
        `${data.tenantId}/emp-${emp.id}`,
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
          tenant_id: data.tenantId,
          numero: u.numero,
          bloco: u.bloco ?? null,
          andar: u.andar ?? null,
          tipo_planta: u.tipo_planta ?? null,
          area: u.area ?? null,
          preco: u.preco ?? null,
        });
      }
    } else {
      const { data: imovel, error: imovelErr } = await supabaseAdmin
        .from("imoveis")
        .insert({
          tenant_id: data.tenantId,
          titulo: data.nome,
          slug: slugifyLote(data.nome),
          publicado: false,
          preco: data.imovel?.preco ?? undefined,
          area_total: data.imovel?.area_total ?? undefined,
          quartos: data.imovel?.quartos ?? undefined,
          descricao: data.imovel?.descricao ?? undefined,
        })
        .select("id")
        .single();
      if (imovelErr || !imovel) throw new Error(imovelErr?.message ?? "Erro ao criar imóvel.");
      imovelId = imovel.id;

      const copiadas = await copiarMidiasParaBucket(
        midiasSelecionadas ?? [],
        `${data.tenantId}/${imovel.id}`,
      );
      for (let i = 0; i < copiadas.length; i++) {
        const c = copiadas[i];
        await supabaseAdmin.from("imovel_fotos").insert({
          imovel_id: imovel.id,
          tenant_id: data.tenantId,
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

    await supabaseAdmin
      .from("construtora_ingestao_lotes")
      .update({
        status: "aprovado",
        empreendimento_id: empreendimentoId,
        imovel_id: imovelId,
        revisado_por: userId,
        revisado_em: new Date().toISOString(),
      })
      .eq("id", data.loteId);

    return { empreendimentoId, imovelId };
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
