import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHmac } from "crypto";

const MAX_ATTEMPTS = 5;
const BATCH = 20;

export const Route = createFileRoute("/api/public/webhooks/deliver")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = process.env.WEBHOOK_WORKER_TOKEN;
        if (token && auth !== `Bearer ${token}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: pending, error } = await supabaseAdmin
          .from("webhook_deliveries")
          .select("id,webhook_id,tenant_id,evento,payload,tentativas,tenant_webhooks(url,secret,ativo)")
          .in("status", ["pendente", "tentando"])
          .lt("tentativas", MAX_ATTEMPTS)
          .order("created_at", { ascending: true })
          .limit(BATCH);

        if (error) return new Response(error.message, { status: 500 });

        let ok = 0, fail = 0;
        for (const d of pending ?? []) {
          const w = (d as any).tenant_webhooks;
          if (!w?.ativo) {
            await supabaseAdmin.from("webhook_deliveries").update({
              status: "cancelada", last_error: "Webhook inativo",
            }).eq("id", d.id);
            continue;
          }
          const body = JSON.stringify(d.payload);
          const signature = createHmac("sha256", w.secret).update(body).digest("hex");
          try {
            const res = await fetch(w.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Imob365-Event": d.evento,
                "X-Imob365-Signature": signature,
                "X-Imob365-Delivery": d.id,
              },
              body,
              signal: AbortSignal.timeout(10000),
            });
            const text = await res.text().catch(() => "");
            const success = res.ok;
            await supabaseAdmin.from("webhook_deliveries").update({
              status: success ? "entregue" : (d.tentativas + 1 >= MAX_ATTEMPTS ? "falhou" : "tentando"),
              response_status: res.status,
              response_body: text.slice(0, 2000),
              tentativas: d.tentativas + 1,
              delivered_at: success ? new Date().toISOString() : null,
              last_error: success ? null : `HTTP ${res.status}`,
            }).eq("id", d.id);
            success ? ok++ : fail++;
          } catch (e: any) {
            const msg = e?.message ?? String(e);
            await supabaseAdmin.from("webhook_deliveries").update({
              status: d.tentativas + 1 >= MAX_ATTEMPTS ? "falhou" : "tentando",
              tentativas: d.tentativas + 1,
              last_error: msg.slice(0, 1000),
            }).eq("id", d.id);
            fail++;
          }
        }

        return Response.json({ processed: (pending ?? []).length, ok, fail });
      },
    },
  },
});