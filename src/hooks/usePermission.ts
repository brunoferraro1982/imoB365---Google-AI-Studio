/**
 * Hook utilitário para verificação de permissões IAM nos componentes React.
 * Considera overrides explícitos de user_permissions antes da matriz de roles.
 *
 * Uso:
 *   const canEdit = usePermission("juridico", "write");
 *   const canViewFinanceiro = usePermission("financeiro", "read");
 *
 *   {canEdit && <Button>Editar contrato</Button>}
 */

import { useAuth } from "@/hooks/useAuth";
import { canAccessModule, canWithOverrides } from "@/lib/permissions";
import type { AppModule, AppAction } from "@/lib/permissions";

export function usePermission(module: AppModule, action: AppAction): boolean {
  const { roles, userPermissions } = useAuth();
  return canWithOverrides(roles, userPermissions, module, action);
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
  const { roles, userPermissions } = useAuth();
  return {
    read:   canWithOverrides(roles, userPermissions, module, "read"),
    write:  canWithOverrides(roles, userPermissions, module, "write"),
    delete: canWithOverrides(roles, userPermissions, module, "delete"),
    config: canWithOverrides(roles, userPermissions, module, "config"),
  };
}
