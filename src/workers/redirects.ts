/**
 * Cloudflare Worker — Redirects 301 para rotas movidas
 *
 * Deploy: wrangler publish src/workers/redirects.ts
 * Ou integrar ao worker principal como middleware.
 *
 * Mantido em sync com a tabela `route_aliases` no Supabase.
 * Em produção, consultar a tabela via Supabase REST para redirects dinâmicos.
 */

const STATIC_REDIRECTS: Record<string, string> = {
  "/app/configuracoes/plano-contas":  "/app/financeiro/plano-contas",
  "/app/configuracoes/centros-custo": "/app/financeiro/centros-custo",
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const redirect = STATIC_REDIRECTS[url.pathname];

    if (redirect) {
      url.pathname = redirect;
      return Response.redirect(url.toString(), 301);
    }

    // Continuar para o origin
    return fetch(request);
  },
};
