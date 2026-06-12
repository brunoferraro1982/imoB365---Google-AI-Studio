/**
 * Route Guards para TanStack Router.
 * Usa beforeLoad para bloquear acesso não autorizado antes de renderizar.
 *
 * Uso na definição de rota:
 *   export const Route = createFileRoute("/app/financeiro")({
 *     beforeLoad: moduleGuard("financeiro"),
 *     component: FinanceiroPage,
 *   });
 */

import { redirect } from "@tanstack/react-router";
import { canAccessModule, can } from "@/lib/permissions";
import type { AppModule, AppAction } from "@/lib/permissions";
import type { AppRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Cache de roles por usuário com TTL de 5 minutos para evitar queries repetidas a cada navegação
let _rolesCache: { userId: string; roles: AppRole[]; at: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

export function invalidateRolesCache() {
  _rolesCache = null;
}

/**
 * Carrega roles via sessão local (sem HTTP ao servidor Auth) + cache de DB.
 * getSession() lê do storage local — não faz request de rede, eliminando o travamento na navegação.
 */
async function getServerRoles(): Promise<AppRole[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const now = Date.now();
  if (_rolesCache && _rolesCache.userId === session.user.id && now - _rolesCache.at < CACHE_TTL_MS) {
    return _rolesCache.roles;
  }

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  _rolesCache = { userId: session.user.id, roles, at: now };
  return roles;
}

/**
 * Guard de módulo: bloqueia acesso se o usuário não tem nenhuma ação no módulo.
 * Redireciona para /app com query param forbidden=true.
 */
export function moduleGuard(module: AppModule) {
  return async () => {
    const roles = await getServerRoles();
    if (roles.length === 0) throw redirect({ to: "/login" });
    if (!canAccessModule(roles, module)) {
      throw redirect({ to: "/app", search: { forbidden: "1" } });
    }
  };
}

/**
 * Guard de ação específica: bloqueia se não tem a ação requerida.
 */
export function actionGuard(module: AppModule, action: AppAction) {
  return async () => {
    const roles = await getServerRoles();
    if (roles.length === 0) throw redirect({ to: "/login" });
    if (!can(roles, module, action)) {
      throw redirect({ to: "/app", search: { forbidden: "1" } });
    }
  };
}

/**
 * Guard de role direta: exige pelo menos uma das roles listadas.
 */
export function roleGuard(...requiredRoles: AppRole[]) {
  return async () => {
    const roles = await getServerRoles();
    if (roles.length === 0) throw redirect({ to: "/login" });
    const hasAccess = requiredRoles.some((r) => roles.includes(r));
    if (!hasAccess) {
      throw redirect({ to: "/app", search: { forbidden: "1" } });
    }
  };
}
