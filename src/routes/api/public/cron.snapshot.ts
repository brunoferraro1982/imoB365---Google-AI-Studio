import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/cron/snapshot")({
  server: {
    handlers: {
      POST: async () => {
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
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "POST to run snapshot" }), {
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
