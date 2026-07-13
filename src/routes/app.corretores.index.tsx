import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/corretores/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/configuracoes/equipe" });
  },
});
