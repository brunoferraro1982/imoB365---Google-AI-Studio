import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/lib/rateLimit";

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

export const Route = createFileRoute("/api/public/v1/imoveis/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const auth = await authenticate(request);
        if (!auth)
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS },
          });

        const rl = checkRateLimit(`v1-api:${auth.tenant_id}`, { max: 60, windowMs: 60_000 });
        if (!rl.allowed)
          return new Response(JSON.stringify({ error: "Too Many Requests" }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rl.retryAfterSeconds),
              ...CORS,
            },
          });

        const { data: imovel, error } = await supabaseAdmin
          .from("imoveis")
          .select(
            "id,slug,titulo,descricao,tipo,finalidade,preco,condominio,iptu,area_util,area_total,quartos,suites,banheiros,vagas,endereco_logradouro,endereco_numero,endereco_bairro,endereco_cidade,endereco_uf,endereco_cep,latitude,longitude,caracteristicas,publicado_em",
          )
          .eq("tenant_id", auth.tenant_id)
          .eq("slug", params.slug)
          .eq("publicado", true)
          .eq("status", "ativo")
          .maybeSingle();

        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        if (!imovel)
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...CORS },
          });

        const { data: fotos } = await supabaseAdmin
          .from("imovel_fotos")
          .select("storage_path")
          .eq("imovel_id", imovel.id)
          .order("capa", { ascending: false })
          .order("ordem");
        const fotoUrls = (fotos ?? []).map(
          (f) =>
            supabaseAdmin.storage.from("imovel-fotos").getPublicUrl(f.storage_path).data.publicUrl,
        );

        return new Response(JSON.stringify({ data: { ...imovel, fotos: fotoUrls } }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
