import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/minhas-buscas")({
  beforeLoad: () => {
    throw redirect({ to: "/conta/buscas" });
  },
});
