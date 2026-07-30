import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processarIngestao } from "@/lib/construtoraIngestao";

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
