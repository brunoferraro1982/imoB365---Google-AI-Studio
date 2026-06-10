import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/favoritos")({
  beforeLoad: () => {
    throw redirect({ to: "/conta/favoritos" });
  },
});
