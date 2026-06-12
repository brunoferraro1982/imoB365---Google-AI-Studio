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

/** Carrega roles do usuário atual diretamente do servidor (não depende de estado React) */
async function getServerRoles(): Promise<AppRole[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  return (data ?? []).map((r) => r.role as AppRole);
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
