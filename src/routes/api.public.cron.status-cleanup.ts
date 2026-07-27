import { createFileRoute } from "@tanstack/react-router";
import { limparChecksAntigos } from "@/lib/statusPage";

// Roda uma vez por dia via pg_cron (ver
// supabase/migrations/20260728100000_status_page.sql) — apaga status_checks
// além dos 90 dias de retenção, mesmo padrão do find -mtime +N -delete já
// usado no backup diário do Postgres.
export const Route = createFileRoute("/api/public/cron/status-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const apagados = await limparChecksAntigos(90);

        return Response.json({ ok: true, apagados });
      },
    },
  },
});
