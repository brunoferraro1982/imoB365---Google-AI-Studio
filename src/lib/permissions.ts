/**
 * IAM — Permission Matrix
 * Controla acesso por role × módulo × ação.
 *
 * CAMADAS DE SEGURANÇA:
 *   1. Esta matriz filtra UI (menus, botões)
 *   2. routeGuard.ts bloqueia navegação de rota
 *   3. RLS no Supabase é a última linha de defesa (server-side)
 */

import type { AppRole } from "@/hooks/useAuth";

export type AppModule =
  | "imobiliario"
  | "juridico"
  | "financeiro"
  | "marketing"
  | "ajustes"
  | "admin";

export type AppAction = "read" | "write" | "delete" | "config";

// Matriz RBAC: role → módulo → ações permitidas
const PERMISSION_MATRIX: Record<AppRole, Partial<Record<AppModule, AppAction[]>>> = {
  super_admin: {
    imobiliario: ["read", "write", "delete", "config"],
    juridico:    ["read", "write", "delete", "config"],
    financeiro:  ["read", "write", "delete", "config"],
    marketing:   ["read", "write", "delete", "config"],
    ajustes:     ["read", "write", "delete", "config"],
    admin:       ["read", "write", "delete", "config"],
  },
  admin: {
    imobiliario: ["read", "write", "delete", "config"],
    juridico:    ["read", "write", "delete", "config"],
    financeiro:  ["read", "write", "delete", "config"],
    marketing:   ["read", "write", "delete", "config"],
    ajustes:     ["read", "write", "config"],
    admin:       [], // sem acesso ao painel super-admin
  },
  broker: {
    imobiliario: ["read", "write"],
    juridico:    ["read"],
    financeiro:  [],              // SEM ACESSO — dados financeiros protegidos
    marketing:   ["read"],
    ajustes:     [],
  },
  juridico: {
    imobiliario: ["read"],
    juridico:    ["read", "write", "delete", "config"],
    financeiro:  [],
    marketing:   [],
    ajustes:     [],
  },
  financeiro: {
    imobiliario: ["read"],
    juridico:    [],
    financeiro:  ["read", "write", "delete", "config"],
    marketing:   [],
    ajustes:     [],
  },
  atendente: {
    imobiliario: ["read", "write"], // leads e visitas
    juridico:    [],
    financeiro:  [],
    marketing:   ["read"],
    ajustes:     [],
  },
};

/**
 * Verifica se um array de roles tem permissão para uma ação em um módulo.
 * Usa OR entre roles — se qualquer role autorizar, acesso concedido.
 */
export function can(roles: AppRole[], module: AppModule, action: AppAction): boolean {
  return roles.some((role) => {
    const allowed = PERMISSION_MATRIX[role]?.[module] ?? [];
    return allowed.includes(action);
  });
}

/**
 * Verifica se um array de roles tem acesso a um módulo (qualquer ação).
 */
export function canAccessModule(roles: AppRole[], module: AppModule): boolean {
  return roles.some((role) => {
    const allowed = PERMISSION_MATRIX[role]?.[module] ?? [];
    return allowed.length > 0;
  });
}

/**
 * Retorna todas as ações permitidas para um módulo dado um array de roles.
 */
export function allowedActions(roles: AppRole[], module: AppModule): AppAction[] {
  const actions = new Set<AppAction>();
  roles.forEach((role) => {
    (PERMISSION_MATRIX[role]?.[module] ?? []).forEach((a) => actions.add(a));
  });
  return Array.from(actions);
}

/**
 * Verifica se um módulo está habilitado no plano do tenant.
 * Usar em conjunto com canAccessModule() para controle completo.
 *
 * Uso:
 *   const ok = isModuleEnabled(enabledModules, "juridico");
 */
export function isModuleEnabled(enabledModules: AppModule[], module: AppModule): boolean {
  // Se lista vazia, considerar tudo habilitado (fallback seguro para tenant 0)
  if (enabledModules.length === 0) return true;
  return enabledModules.includes(module);
}

/**
 * Combinação de role + plano: retorna true apenas se
 * o usuário tem role com acesso E o módulo está no plano.
 */
export function canAndEnabled(
  roles: AppRole[],
  enabledModules: AppModule[],
  module: AppModule,
  action: AppAction
): boolean {
  return isModuleEnabled(enabledModules, module) && can(roles, module, action);
}
