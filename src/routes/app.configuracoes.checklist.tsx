import { createFileRoute, redirect } from "@tanstack/react-router";

// Checklist migrou para o Jurídico. Mantém o link antigo funcionando.
export const Route = createFileRoute("/app/configuracoes/checklist")({
  beforeLoad: () => {
    throw redirect({ to: "/app/contratos/checklist" });
  },
});
