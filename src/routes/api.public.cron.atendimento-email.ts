import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pollarTodosCanaisEmail } from "@/lib/atendimentoEmailInbound";

// Roda periodicamente via pg_cron (agendamento manual — mesmo padrão dos
// outros crons de atendimento, ver instruções de migration). Varre todo
// tenant com canal de e-mail ativo (a própria imoB365 inclusa, mesma
// tabela — ver memória "imob365-tenant-autonomy-byo-credentials") e
// importa mensagens não lidas como chamados/respostas novas.
export const Route = createFileRoute("/api/public/cron/atendimento-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const resultados = await pollarTodosCanaisEmail(supabaseAdmin);
        return Response.json({ ok: true, resultados });
      },
    },
  },
});
