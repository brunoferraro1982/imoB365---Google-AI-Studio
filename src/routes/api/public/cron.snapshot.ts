import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function authorizeRequest(request: Request): boolean {
  const apikey = request.headers.get("apikey") ?? "";
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  return !(!expected || expected.length < 20 || apikey !== expected);
}

export const Route = createFileRoute("/api/public/cron/snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { data, error } = await (supabaseAdmin.rpc as any)("cron_snapshot_tenant_usage");
        if (error)
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        return new Response(JSON.stringify({ ok: true, rows: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async ({ request }) => {
        if (!authorizeRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        return new Response(JSON.stringify({ ok: true, hint: "POST to run snapshot" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
