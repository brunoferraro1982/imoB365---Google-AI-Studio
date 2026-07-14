/**
 * Rota legada — duplicava /privacidade (mesma política, sem header/footer).
 * Mantida como redirect para não quebrar backlinks/SEO já indexados.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-privacidade")({
  beforeLoad: () => {
    throw redirect({ to: "/privacidade", replace: true });
  },
});
