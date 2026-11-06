import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processarIngestao } from "@/lib/construtoraIngestao";

// Roda diariamente via pg_cron (ver supabase/migrations/
// ..._construtora_ingestao_cron.sql) — a própria engine decide, por fonte,
// se já passou o intervalo configurado (intervalo_horas + ultima_execucao),
// mesmo padrão de src/routes/api.public.cron.captacao.ts.
//
// Achado real (produção, dataset real do GMV): o ciclo completo leva
// 20-25+ minutos — muito além do timeout padrão de `net.http_post` do
// pg_cron/pg_net (poucos segundos) e do nginx na frente do app. Por isso
// não espera processarIngestao terminar: dispara em segundo plano
// (fire-and-forget, o processo Node continua rodando depois da resposta)
// e responde na hora — o pg_cron só precisa confirmar que o disparo
// aconteceu, não o resultado final.
async function dispararEmSegundoPlano(request: Request): Promise<Response> {
  const apikey = request.headers.get("apikey") ?? "";
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  if (!expected || expected.length < 20 || apikey !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  processarIngestao(supabaseAdmin).catch((err) => {
    console.error("[construtoraIngestao] cron falhou em segundo plano:", err);
  });

  return Response.json({ ok: true, iniciado: true });
}

export const Route = createFileRoute("/api/public/cron/construtora-ingestao")({
  server: {
    handlers: {
      POST: async ({ request }) => dispararEmSegundoPlano(request),
      GET: async ({ request }) => dispararEmSegundoPlano(request),
    },
  },
});
