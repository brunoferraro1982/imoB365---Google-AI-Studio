import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processarIngestao } from "@/lib/construtoraIngestao";

// Roda diariamente via pg_cron (ver supabase/migrations/
// ..._construtora_ingestao_cron.sql) — a própria engine decide, por fonte,
// se já passou o intervalo configurado (intervalo_horas + ultima_execucao),
// mesmo padrão de src/routes/api.public.cron.captacao.ts.
export const Route = createFileRoute("/api/public/cron/construtora-ingestao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const resultado = await processarIngestao(supabaseAdmin);
        return Response.json({ ok: true, ...resultado });
      },
      GET: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || expected.length < 20 || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const resultado = await processarIngestao(supabaseAdmin);
        return Response.json({ ok: true, ...resultado });
      },
    },
  },
});
