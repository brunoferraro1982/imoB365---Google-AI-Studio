import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Edge Function: converte automaticamente trials expirados para plan-free.
// Pode ser invocada por cron via Supabase Scheduled Functions ou HTTP com Authorization.

Deno.serve(async (req) => {
  try {
    // Verifica autorização (Bearer token = service_role key ou anon key de cron)
    const auth = req.headers.get("Authorization") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (cronSecret && auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Chama a função SQL que converte todos os trials expirados de uma vez
    const { data, error } = await supabase.rpc("expire_all_trials");

    if (error) {
      console.error("[convert-trial-to-free]", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[convert-trial-to-free] Convertidos: ${data}`);

    return new Response(
      JSON.stringify({ ok: true, converted: data, timestamp: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[convert-trial-to-free] Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
