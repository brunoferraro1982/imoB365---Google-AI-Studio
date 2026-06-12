/**
 * Helpers de autenticação para Server Functions (TanStack Start).
 *
 * REGRA DE SEGURANÇA:
 *   Server functions NUNCA devem aceitar tenant_id ou user_id como parâmetro.
 *   Sempre usar getServerTenantId() / getServerUserId() para obter do token JWT.
 *
 * Uso em createServerFn:
 *   export const getImoveis = createServerFn("GET", async () => {
 *     const { tenantId } = await requireServerAuth();
 *     const { data } = await supabase.from("imoveis").select("*")
 *       .eq("tenant_id", tenantId);   // 👈 nunca do request.body
 *     return data;
 *   });
 */

import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Obtém o usuário autenticado server-side via JWT.
 * Lança AuthError 401 se não autenticado.
 */
export async function getServerUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError("Não autenticado", 401);
  return user;
}

/**
 * Obtém o tenant_id do usuário autenticado via profiles.
 * SEMPRE usar isto — nunca aceitar tenant_id de parâmetros externos.
 */
export async function getServerTenantId(): Promise<string> {
  const user = await getServerUser();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (error || !profile?.tenant_id) {
    throw new AuthError("Perfil de tenant não encontrado", 403);
  }
  return profile.tenant_id as string;
}

/**
 * Obtém as roles do usuário autenticado server-side.
 */
export async function getServerRoles(): Promise<AppRole[]> {
  const user = await getServerUser();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  return (data ?? []).map((r) => r.role as AppRole);
}

/**
 * Wrapper completo: retorna user, tenantId e roles.
 * Para server functions que precisam de tudo.
 */
export async function requireServerAuth() {
  const user = await getServerUser();
  const [tenantId, roles] = await Promise.all([
    getServerTenantId(),
    getServerRoles(),
  ]);
  return { user, tenantId, roles };
}

/**
 * Exige role específica server-side.
 * Lança AuthError 403 se role não presente.
 */
export async function requireServerRole(...requiredRoles: AppRole[]) {
  const { user, tenantId, roles } = await requireServerAuth();
  const hasRole = requiredRoles.some((r) => roles.includes(r));
  if (!hasRole) {
    throw new AuthError(
      `Acesso negado. Requer: ${requiredRoles.join(" ou ")}`,
      403
    );
  }
  return { user, tenantId, roles };
}
