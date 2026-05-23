import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(req: Request) {
  const key = req.headers.get("x-api-key") ?? "";
  if (!key) return null;
  const hash = await sha256Hex(key);
  const { data } = await supabaseAdmin
    .from("tenant_api_keys")
    .select("id,tenant_id,ativo,expires_at,scopes")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!data || !data.ativo) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  void supabaseAdmin.from("tenant_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
};

export const Route = createFileRoute("/api/public/v1/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...CORS } });

        let body: any;
        try { body = await request.json(); }
        catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } }); }

        const nome = String(body?.nome ?? "").trim().slice(0, 200);
        if (!nome) return new Response(JSON.stringify({ error: "nome obrigatório" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });

        const payload = {
          tenant_id: auth.tenant_id,
          nome,
          email: body?.email ? String(body.email).slice(0, 200) : null,
          telefone: body?.telefone ? String(body.telefone).slice(0, 50) : null,
          mensagem: body?.mensagem ? String(body.mensagem).slice(0, 2000) : null,
          origem: "api" as any,
          imovel_id: body?.imovel_id ?? null,
        };
        const { data, error } = await supabaseAdmin.from("leads").insert(payload).select("id").single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...CORS } });

        return new Response(JSON.stringify({ id: data.id }), { status: 201, headers: { "Content-Type": "application/json", ...CORS } });
      },
    },
  },
});