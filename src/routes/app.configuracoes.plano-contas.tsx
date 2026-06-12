/**
 * Rota legada — redireciona para /app/financeiro/plano-contas
 * Mantida para compatibilidade com links antigos e bookmarks.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/configuracoes/plano-contas")({
  beforeLoad: () => {
    throw redirect({ to: "/app/financeiro/plano-contas", replace: true });
  },
});
