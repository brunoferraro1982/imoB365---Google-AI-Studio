/**
 * Rota legada — /a-imob365 é a versão completa desta página institucional
 * (mesmo conteúdo + seções extras). Mantida para compatibilidade com links
 * antigos e bookmarks.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sobre")({
  beforeLoad: () => {
    throw redirect({ to: "/a-imob365", replace: true });
  },
});
