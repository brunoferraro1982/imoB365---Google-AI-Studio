import { createFileRoute } from "@tanstack/react-router";
import { executarChecks } from "@/lib/statusPage";

// Roda a cada 5 minutos via pg_cron (ver
// supabase/migrations/20260728100000_status_page.sql). Checa os serviços
// ativos em status_services e grava o resultado em status_checks — é o que
// alimenta o status atual e a faixa histórica de /status e /admin/status.
export const Route = createFileRoute("/api/public/cron/status-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const resultados = await executarChecks();

        return Response.json({
          ok: true,
          checados: resultados.length,
          resultados: resultados.map((r) => ({
            slug: r.slug,
            status: r.result.status,
            latencyMs: r.result.latencyMs,
          })),
        });
      },
    },
  },
});
