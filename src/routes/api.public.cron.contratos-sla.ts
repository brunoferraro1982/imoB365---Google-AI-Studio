import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runSlaCheck } from "@/lib/slaAlertas";

// Roda periodicamente via pg_cron (uma vez agendado — ver comentário em
// supabase/migrations para instruções). Varre todos os tenants: cartórios
// parados há mais de SLA_CARTORIO_DIAS e contratos ativos a vencer em até
// CONTRATO_VENCIMENTO_DIAS, criando tarefas em lead_tarefas direcionadas ao
// corretor responsável (via contratos.corretor_id -> corretores.user_id).

export const Route = createFileRoute("/api/public/cron/contratos-sla")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const resultado = await runSlaCheck(supabaseAdmin);
        return Response.json({ ok: true, ...resultado });
      },
    },
  },
});
