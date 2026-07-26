// Labels em pt-BR pros valores do enum app_role (chave interna, nunca
// traduzida no banco/comparações de código) — compartilhado entre telas
// que listam papéis de usuário, evita cada tela reinventar o mapa e
// vazar a chave crua (ex: "broker") pro usuário.
export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super-admin",
  admin: "Administrador",
  broker: "Corretor",
  atendente: "Atendente",
  juridico: "Jurídico",
  financeiro: "Financeiro",
};
