import { createFileRoute, redirect } from "@tanstack/react-router";

// Movido para Leads > Funis. Mantido só para links antigos.
export const Route = createFileRoute("/app/configuracoes/funis")({
  beforeLoad: () => {
    throw redirect({ to: "/app/leads/funis" });
  },
});
