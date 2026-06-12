/**
 * Rota legada — redireciona para /app/financeiro/centros-custo
 * Mantida para compatibilidade com links antigos e bookmarks.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/configuracoes/centros-custo")({
  beforeLoad: () => {
    throw redirect({ to: "/app/financeiro/centros-custo", replace: true });
  },
});
