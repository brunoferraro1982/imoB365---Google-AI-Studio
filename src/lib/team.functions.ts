import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "broker", "juridico", "financeiro", "atendente"] as const;

const inviteSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email().max(255),
  role: z.enum(ROLES),
});

/**
 * Adiciona um usuário existente à imobiliária com o papel informado.
 * Apenas admins do tenant ou super_admin podem chamar.
 */
export const inviteTenantMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verifica que o caller é admin do tenant (ou super_admin)
    const { data: isAdmin } = await supabase.rpc("has_role_in_tenant", {
      _user_id: userId,
      _tenant_id: data.tenantId,
      _role: "admin",
    });
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isAdmin && !isSuper) {
      throw new Error("Sem permissão para gerenciar a equipe desta imobiliária");
    }

    // Procura usuário pelo e-mail (admin API)
    const { data: list, error: lookupErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (lookupErr) throw new Error(lookupErr.message);
    const target = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase());
    if (!target) {
      throw new Error("Nenhum usuário com este e-mail. Peça para a pessoa criar a conta primeiro em /signup.");
    }

    // Garante profile + tenant_id
    await supabaseAdmin.from("profiles").upsert({
      id: target.id,
      nome: (target.user_metadata as any)?.nome ?? target.email,
      tenant_id: data.tenantId,
    });

    // Insere role (idempotente via unique parcial — ignora duplicado)
    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: target.id,
      tenant_id: data.tenantId,
      role: data.role,
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(error.message);
    }

    return { userId: target.id, email: target.email };
  });

/**
 * Lista membros do tenant com nome/email.
 */
export const listTenantMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role_in_tenant", {
      _user_id: userId, _tenant_id: data.tenantId, _role: "admin",
    });
    const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) throw new Error("Sem permissão");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("id,user_id,role")
      .eq("tenant_id", data.tenantId);

    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return { members: [] as { user_id: string; nome: string | null; email: string | null; roles: string[]; role_ids: string[] }[] };

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,nome").in("id", ids);
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailMap = new Map(usersList.users.map((u) => [u.id, u.email ?? null]));
    const nomeMap = new Map((profiles ?? []).map((p: any) => [p.id, p.nome ?? null]));

    const members = ids.map((id) => {
      const userRoles = (roles ?? []).filter((r) => r.user_id === id);
      return {
        user_id: id,
        nome: nomeMap.get(id) ?? null,
        email: emailMap.get(id) ?? null,
        roles: userRoles.map((r) => r.role),
        role_ids: userRoles.map((r) => r.id),
      };
    });
    return { members };
  });

export const removeTenantMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ tenantId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role_in_tenant", {
      _user_id: userId, _tenant_id: data.tenantId, _role: "admin",
    });
    const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) throw new Error("Sem permissão");
    if (data.userId === userId) throw new Error("Você não pode remover a si mesmo");

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.userId)
      .neq("role", "super_admin");
    return { ok: true };
  });