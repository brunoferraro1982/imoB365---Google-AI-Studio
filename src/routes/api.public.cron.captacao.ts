import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processarCaptacoes, verificarDisponibilidade } from "@/lib/captacao";

// Roda de hora em hora via pg_cron (ver supabase/migrations/
// ..._create_captacao_tables.sql) — a própria engine decide, por config,
// se já passou o intervalo configurado (intervalo_horas + ultima_execucao).
export const Route = createFileRoute("/api/public/cron/captacao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const captura = await processarCaptacoes(supabaseAdmin);
        const disponibilidade = await verificarDisponibilidade(supabaseAdmin);
        return Response.json({ ok: true, captura, disponibilidade });
      },
      GET: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const captura = await processarCaptacoes(supabaseAdmin);
        const disponibilidade = await verificarDisponibilidade(supabaseAdmin);
        return Response.json({ ok: true, captura, disponibilidade });
      },
    },
  },
});
