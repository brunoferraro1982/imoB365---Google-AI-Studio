/**
 * Rota legada — /a-imob365 é a versão completa desta página institucional
 * (mesmo conteúdo + seções extras). Mantida para compatibilidade com links
 * antigos e bookmarks.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sobre")({
  beforeLoad: () => {
    // 301 permanente (não o default 307): a auditoria GSC mostrou que, como
    // temporário, o Google mantinha /sobre como canônica e deixava /a-imob365
    // fora do índice. Com 301 ele consolida os sinais em /a-imob365 (a versão
    // completa, já listada no sitemap).
    throw redirect({ to: "/a-imob365", statusCode: 301, replace: true });
  },
});
