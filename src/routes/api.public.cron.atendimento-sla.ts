import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarChamadosSLA } from "@/lib/atendimentoSla";

// Roda periodicamente via pg_cron (agendamento manual, mesmo padrão dos
// outros crons de atendimento). Varre todo chamado em aberto com SLA
// estourado (primeira resposta ou resolução) e cria uma tarefa em
// lead_tarefas endereçada ao atendente responsável.
export const Route = createFileRoute("/api/public/cron/atendimento-sla")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const resultado = await verificarChamadosSLA(supabaseAdmin);
        return Response.json({ ok: true, ...resultado });
      },
    },
  },
});
