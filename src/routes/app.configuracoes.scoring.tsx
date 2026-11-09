import { createFileRoute, redirect } from "@tanstack/react-router";

// Movido para Leads > Pontuação. Mantido só para links antigos.
export const Route = createFileRoute("/app/configuracoes/scoring")({
  beforeLoad: () => {
    throw redirect({ to: "/app/leads/pontuacao" });
  },
});
