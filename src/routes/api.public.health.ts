import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        let db: "ok" | "error" = "ok";
        let dbError: string | null = null;
        try {
          const { error } = await supabaseAdmin.from("tenants").select("id", { count: "exact", head: true });
          if (error) { db = "error"; dbError = error.message; }
        } catch (e: any) {
          db = "error"; dbError = e?.message ?? "unknown";
        }
        const body = {
          status: db === "ok" ? "ok" : "degraded",
          timestamp: new Date().toISOString(),
          latency_ms: Date.now() - started,
          checks: { database: { status: db, error: dbError } },
          version: "1.0.0",
        };
        return new Response(JSON.stringify(body), {
          status: db === "ok" ? 200 : 503,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});