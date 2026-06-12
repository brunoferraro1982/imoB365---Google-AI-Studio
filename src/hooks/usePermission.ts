/**
 * Hook utilitário para verificação de permissões IAM nos componentes React.
 *
 * Uso:
 *   const canEdit = usePermission("juridico", "write");
 *   const canViewFinanceiro = usePermission("financeiro", "read");
 *
 *   {canEdit && <Button>Editar contrato</Button>}
 */

import { useAuth } from "@/hooks/useAuth";
import { can, canAccessModule } from "@/lib/permissions";
import type { AppModule, AppAction } from "@/lib/permissions";

export function usePermission(module: AppModule, action: AppAction): boolean {
  const { roles } = useAuth();
  return can(roles, module, action);
}

export function useModuleAccess(module: AppModule): boolean {
  const { roles } = useAuth();
  return canAccessModule(roles, module);
}

/**
 * Retorna objeto com flags de permissão para um módulo.
 * Evita múltiplas chamadas a usePermission.
 *
 * Uso:
 *   const perms = useModulePermissions("financeiro");
 *   {perms.write && <Button>Novo lançamento</Button>}
 */
export function useModulePermissions(module: AppModule) {
  const { roles } = useAuth();
  return {
    read:   can(roles, module, "read"),
    write:  can(roles, module, "write"),
    delete: can(roles, module, "delete"),
    config: can(roles, module, "config"),
  };
}
