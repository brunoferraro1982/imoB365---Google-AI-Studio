import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/feeds/$tenantSlug/olx.xml")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { tenantSlug } = params;

        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("id,nome,slug")
          .eq("slug", tenantSlug)
          .maybeSingle();
        if (!tenant) return new Response("Tenant not found", { status: 404 });

        const { data: feed } = await supabaseAdmin
          .from("portal_feeds")
          .select("enabled")
          .eq("tenant_id", tenant.id)
          .eq("portal_slug", "olx")
          .eq("enabled", true)
          .maybeSingle();
        if (!feed) return new Response("Feed disabled", { status: 404 });

        const { data: imoveis } = await supabaseAdmin
          .from("imoveis")
          .select("id,slug,titulo,descricao,finalidade,tipo,preco,condominio,iptu,area_util,area_total,quartos,banheiros,vagas,endereco_logradouro,endereco_numero,endereco_bairro,endereco_cidade,endereco_uf,endereco_cep,latitude,longitude,updated_at,codigo_interno")
          .eq("tenant_id", tenant.id)
          .eq("publicado", true)
          .eq("status", "ativo")
          .order("updated_at", { ascending: false })
          .limit(1000);

        const ids = (imoveis ?? []).map((i) => i.id);
        const { data: fotos } = ids.length
          ? await supabaseAdmin.from("imovel_fotos").select("imovel_id,storage_path").in("imovel_id", ids).order("capa", { ascending: false }).order("ordem")
          : { data: [] as any[] };

        const fotoMap = new Map<string, string[]>();
        for (const f of fotos ?? []) {
          const url = supabaseAdmin.storage.from("imovel-fotos").getPublicUrl(f.storage_path).data.publicUrl;
          const arr = fotoMap.get(f.imovel_id) ?? [];
          arr.push(url);
          fotoMap.set(f.imovel_id, arr);
        }

        const origin = new URL(request.url).origin;
        const xml = buildOlxXml(imoveis ?? [], fotoMap, origin);

        try {
          const ua = request.headers.get("user-agent") ?? null;
          const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
          await supabaseAdmin
            .from("portal_feeds")
            .update({ last_pulled_at: new Date().toISOString(), last_pull_ua: ua, last_pull_ip: ip, validation_status: "ok" })
            .eq("tenant_id", tenant.id)
            .eq("portal_slug", "olx");
        } catch {}

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});

// OLX Realty maps
const TIPO_OLX: Record<string, { category: string; subcategory: string; type: string }> = {
  apartamento: { category: "1020", subcategory: "1040", type: "APARTMENT" },
  casa:        { category: "1020", subcategory: "1060", type: "HOUSE" },
  cobertura:   { category: "1020", subcategory: "1040", type: "PENTHOUSE" },
  terreno:     { category: "1020", subcategory: "1080", type: "ALLOTMENT_LAND" },
  comercial:   { category: "1040", subcategory: "1120", type: "COMMERCIAL_BUILDING" },
  galpao:      { category: "1040", subcategory: "1140", type: "WAREHOUSE" },
  chacara:     { category: "1020", subcategory: "1100", type: "FARM" },
  outro:       { category: "1020", subcategory: "1060", type: "HOUSE" },
};
const FINALIDADE_OLX: Record<string, string> = { venda: "SALE", aluguel: "RENT", temporada: "RENT" };

function esc(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}
function tag(name: string, value: unknown): string {
  if (value == null || value === "") return "";
  return `<${name}>${esc(value)}</${name}>`;
}
function cdata(name: string, value: unknown): string {
  if (value == null || value === "") return "";
  return `<${name}><![CDATA[${String(value)}]]></${name}>`;
}

function buildOlxXml(imoveis: any[], fotoMap: Map<string, string[]>, baseUrl: string): string {
  const ads = imoveis.map((i) => {
    const meta = TIPO_OLX[i.tipo] ?? TIPO_OLX.outro;
    const fotos = (fotoMap.get(i.id) ?? []).slice(0, 20);
    const images = fotos.map((url) => `<image><image_url><![CDATA[${url}]]></image_url></image>`).join("");
    const adType = FINALIDADE_OLX[i.finalidade] ?? "SALE";

    return `<ad>
      ${tag("id", i.codigo_interno ?? i.id)}
      ${tag("category_id", meta.category)}
      ${tag("subject", i.titulo)}
      ${cdata("body", i.descricao)}
      ${tag("price", i.preco)}
      ${tag("currency", "BRL")}
      ${tag("ad_type", adType)}
      ${tag("property_type", meta.type)}
      ${tag("real_estate_type", meta.type)}
      <location>
        ${tag("zipcode", i.endereco_cep)}
        ${tag("city", i.endereco_cidade)}
        ${tag("region", i.endereco_uf)}
        ${tag("neighbourhood", i.endereco_bairro)}
        ${tag("street", i.endereco_logradouro)}
        ${tag("street_number", i.endereco_numero)}
        ${tag("latitude", i.latitude)}
        ${tag("longitude", i.longitude)}
      </location>
      <details>
        ${tag("rooms", i.quartos)}
        ${tag("bathrooms", i.banheiros)}
        ${tag("garage_spaces", i.vagas)}
        ${tag("size", i.area_util ?? i.area_total)}
        ${tag("condominium_fee", i.condominio)}
        ${tag("iptu", i.iptu)}
      </details>
      <images>${images}</images>
      ${tag("url", `${baseUrl}/imovel/${i.slug}`)}
    </ad>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ad-list>${ads}</ad-list>`;
}
