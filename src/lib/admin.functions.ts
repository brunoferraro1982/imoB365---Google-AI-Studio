import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Acesso negado");

    const [{ data: profiles }, { data: authData }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 }),
    ]);

    const authMap = new Map(
      (authData?.users ?? []).map((u) => [
        u.id,
        {
          email: u.email ?? null,
          creci: (u.user_metadata as Record<string, unknown>)?.creci as string | null ?? null,
          provider: (u.app_metadata as Record<string, unknown>)?.provider as string | null ?? null,
          created_at: u.created_at ?? null,
        },
      ]),
    );

    const users = (profiles ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      nome: (p.nome as string) ?? null,
      avatar_url: (p.avatar_url as string) ?? null,
      tenant_id: (p.tenant_id as string) ?? null,
      tipo_usuario: (p.tipo_usuario as string) ?? null,
      plano_pretendido: (p.plano_pretendido as string) ?? null,
      imobiliaria_nome: (p.imobiliaria_nome as string) ?? null,
      aprovado: p.aprovado === true,
      pagamento_validado: p.pagamento_validado === true,
      pagamento_metodo: (p.pagamento_metodo as string) ?? null,
      telefone: (p.telefone as string) ?? null,
      email: authMap.get(p.id as string)?.email ?? null,
      creci: authMap.get(p.id as string)?.creci ?? null,
      provider: authMap.get(p.id as string)?.provider ?? null,
      auth_created_at: authMap.get(p.id as string)?.created_at ?? null,
    }));

    return { users };
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId: callerId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: callerId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Acesso negado");
    if (data.userId === callerId) throw new Error("Não é possível excluir a si mesmo");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("corretores").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Erro ao excluir usuário do auth: " + error.message);

    return { success: true };
  });
