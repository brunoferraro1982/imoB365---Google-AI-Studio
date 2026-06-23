import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// GET/POST /api/public/cron/inadimplencia
// Suspende tenants com billing_due_at vencido.
// Auth: Supabase anon key no header `apikey` (QA-03 compliant).

function authGuard(request: Request): Response | null {
  const apikey  = request.headers.get("apikey") ?? "";
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  if (!expected || expected.length < 20 || apikey !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

async function runInadimplencia(): Promise<{ suspended: number }> {
  const { data, error } = await supabaseAdmin.rpc("inadimplencia_suspend_overdue");
  if (error) throw new Error(error.message);
  return { suspended: (data as number) ?? 0 };
}

export const Route = createFileRoute("/api/public/cron/inadimplencia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const deny = authGuard(request);
        if (deny) return deny;
        try {
          const result = await runInadimplencia();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return new Response(e?.message ?? "error", { status: 500 });
        }
      },
      GET: async ({ request }) => {
        const deny = authGuard(request);
        if (deny) return deny;
        try {
          const result = await runInadimplencia();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return new Response(e?.message ?? "error", { status: 500 });
        }
      },
    },
  },
});
