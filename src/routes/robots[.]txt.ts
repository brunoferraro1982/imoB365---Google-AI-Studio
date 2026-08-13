import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        // Quem serve /robots.txt em produção é o arquivo estático
        // public/robots.txt (vence a rota via static handler do Nitro/nginx).
        // Esta rota é só um fallback — mantida em sincronia com aquele arquivo
        // pra não emitir um robots.txt errado (ex.: Sitemap apontando pro
        // /sitemap.xml, que dá 404) caso o estático suma. O sitemap canônico é
        // o índice em /api/public/sitemap-index.xml.
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /app",
          "Disallow: /admin",
          "Disallow: /api",
          "Allow: /api/sitemap.xml",
          "Allow: /api/public/sitemap-index.xml",
          "Allow: /api/public/sitemap/",
          // /conta$ = a rota exata (minha conta); /conta/ = as sub-rotas. NÃO
          // usar "Disallow: /conta" puro — casa por prefixo e bloqueia /contato
          // (achado da auditoria GSC: /contato ficava "Bloqueada pelo robots").
          "Disallow: /conta$",
          "Disallow: /conta/",
          "",
          `Sitemap: ${origin}/api/public/sitemap-index.xml`,
        ].join("\n");
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
