import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gerarRepassesDoMes } from "@/lib/locacaoRepasses";

// Roda uma vez por mês via pg_cron (ver supabase/migrations/20260726150000).
// Varre todos os tenants, gerando o repasse do mês corrente pra cada
// contrato de locação ativo que ainda não tem repasse nesse mês.
export const Route = createFileRoute("/api/public/cron/gerar-repasses")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const resultado = await gerarRepassesDoMes(supabaseAdmin);
        return Response.json({ ok: true, ...resultado });
      },
    },
  },
});
