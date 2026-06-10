import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  void supabaseAdmin
    .from("tenant_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return data;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
};

export const Route = createFileRoute("/api/public/v1/imoveis")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth)
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS },
          });

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);
        const finalidade = url.searchParams.get("finalidade");
        const cidade = url.searchParams.get("cidade");

        let q = supabaseAdmin
          .from("imoveis")
          .select(
            "id,slug,titulo,descricao,tipo,finalidade,preco,quartos,banheiros,vagas,area_util,endereco_cidade,endereco_uf,endereco_bairro,publicado_em",
            { count: "exact" },
          )
          .eq("tenant_id", auth.tenant_id)
          .eq("publicado", true)
          .eq("status", "ativo")
          .order("publicado_em", { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);
        if (finalidade) q = q.eq("finalidade", finalidade as any);
        if (cidade) q = q.ilike("endereco_cidade", `%${cidade}%`);

        const { data, error, count } = await q;
        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });

        return new Response(JSON.stringify({ data, total: count ?? 0, limit, offset }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
