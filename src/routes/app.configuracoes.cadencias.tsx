import { createFileRoute, redirect } from "@tanstack/react-router";

// Movido para Leads > Cadências. Mantido só para links antigos.
export const Route = createFileRoute("/app/configuracoes/cadencias")({
  beforeLoad: () => {
    throw redirect({ to: "/app/leads/cadencias" });
  },
});
