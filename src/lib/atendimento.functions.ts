import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Lista membros do tenant elegíveis a receber um chamado (pra montar o
 * seletor "Atribuir a"). Diferente de listTenantMembers (team.functions.ts,
 * admin-only), qualquer membro do próprio tenant pode chamar — é só leitura
 * de nome, não gerencia papel/convite de ninguém.
 */
export const listChamadoAssignees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMember } = await supabase.rpc("is_member_of_tenant", {
      _user_id: userId,
      _tenant_id: data.tenantId,
    });
    if (!isMember) throw new Error("Sem permissão");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", data.tenantId)
      .in("role", ["admin", "atendente", "broker"]);

    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [] as { id: string; nome: string }[];

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,nome").in("id", ids);

    return (profiles ?? []).map((p) => ({ id: p.id, nome: p.nome ?? "Sem nome" }));
  });
