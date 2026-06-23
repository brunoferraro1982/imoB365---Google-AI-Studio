import { createAPIFileRoute } from "@tanstack/react-router/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron endpoint: converte trials expirados para plan-free.
// Auth: chave no header `apikey` deve bater com SUPABASE_PUBLISHABLE_KEY.
// QA-03 fix: valida comprimento mínimo da chave antes de comparar.

export const APIRoute = createAPIFileRoute("/api/public/cron/trial-expiry")({
  GET: async ({ request }) => {
    const apikey = request.headers.get("apikey") ?? "";
    const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

    if (!expected || expected.length < 20 || apikey !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseAdmin.rpc("expire_all_trials");

    if (error) {
      console.error("[cron/trial-expiry]", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, converted: data }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
});
