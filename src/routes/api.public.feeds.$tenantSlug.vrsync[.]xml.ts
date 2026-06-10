import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/feeds/$tenantSlug/vrsync.xml")({
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
          .in("portal_slug", ["vivareal", "zap", "wimoveis"])
          .eq("enabled", true)
          .limit(1)
          .maybeSingle();
        if (!feed) return new Response("Feed disabled", { status: 404 });

        const { data: imoveis } = await supabaseAdmin
          .from("imoveis")
          .select(
            "id,slug,titulo,descricao,finalidade,tipo,preco,condominio,iptu,area_util,area_total,quartos,suites,banheiros,vagas,endereco_logradouro,endereco_numero,endereco_bairro,endereco_cidade,endereco_uf,endereco_cep,latitude,longitude,caracteristicas,updated_at,codigo_interno",
          )
          .eq("tenant_id", tenant.id)
          .eq("publicado", true)
          .eq("status", "ativo")
          .order("updated_at", { ascending: false })
          .limit(1000);

        const ids = (imoveis ?? []).map((i) => i.id);
        const { data: fotos } = ids.length
          ? await supabaseAdmin
              .from("imovel_fotos")
              .select("imovel_id,storage_path")
              .in("imovel_id", ids)
              .order("capa", { ascending: false })
              .order("ordem")
          : { data: [] as any[] };

        const fotoMap = new Map<string, string[]>();
        for (const f of fotos ?? []) {
          const url = supabaseAdmin.storage.from("imovel-fotos").getPublicUrl(f.storage_path)
            .data.publicUrl;
          const arr = fotoMap.get(f.imovel_id) ?? [];
          arr.push(url);
          fotoMap.set(f.imovel_id, arr);
        }

        const xml = buildVrsyncXml(tenant, imoveis ?? [], fotoMap);

        // Marca leitura (não bloqueante para a resposta)
        try {
          const ua = request.headers.get("user-agent") ?? null;
          const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
          await supabaseAdmin
            .from("portal_feeds")
            .update({
              last_pulled_at: new Date().toISOString(),
              last_pull_ua: ua,
              last_pull_ip: ip,
              validation_status: "ok",
            })
            .eq("tenant_id", tenant.id)
            .in("portal_slug", ["vivareal", "zap", "wimoveis"]);
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

const FINALIDADE_MAP: Record<string, string> = {
  venda: "Sale",
  aluguel: "Rental",
  temporada: "Vacational",
};
const TIPO_MAP: Record<string, string> = {
  apartamento: "Apartment",
  casa: "Home",
  cobertura: "Penthouse",
  terreno: "ResidentialAllotmentLand",
  comercial: "Office",
  galpao: "Warehouse",
  chacara: "FarmRanch",
  outro: "Home",
};

function esc(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}
function tag(name: string, value: unknown): string {
  if (value == null || value === "") return "";
  return `<${name}>${esc(value)}</${name}>`;
}
function cdata(name: string, value: unknown): string {
  if (value == null || value === "") return "";
  return `<${name}><![CDATA[${String(value)}]]></${name}>`;
}

function buildVrsyncXml(
  tenant: { nome: string; slug: string },
  imoveis: any[],
  fotoMap: Map<string, string[]>,
): string {
  const listings = imoveis
    .map((i) => {
      const fotos = (fotoMap.get(i.id) ?? []).slice(0, 30);
      const media = fotos
        .map(
          (url, idx) =>
            `<Media><MediaURL>${esc(url)}</MediaURL><MediaOrder>${idx + 1}</MediaOrder></Media>`,
        )
        .join("");
      const features = (i.caracteristicas ?? [])
        .map((c: string) => `<Feature>${esc(c)}</Feature>`)
        .join("");
      const transactionType = FINALIDADE_MAP[i.finalidade] ?? "Sale";
      const propertyType = TIPO_MAP[i.tipo] ?? "Home";

      return `<Listing>
      ${tag("ListingID", i.codigo_interno ?? i.id)}
      ${tag("Title", i.titulo)}
      ${cdata("Description", i.descricao)}
      ${tag("TransactionType", transactionType)}
      ${tag("PropertyType", propertyType)}
      <Details>
        ${tag("PropertyType", propertyType)}
        ${tag("ListPrice", i.preco)}
        ${tag("YearlyTax", i.iptu)}
        ${tag("PropertyAdministrationFee", i.condominio)}
        ${tag("LivingArea", i.area_util)}
        ${tag("LotArea", i.area_total)}
        ${tag("Bedrooms", i.quartos)}
        ${tag("Suites", i.suites)}
        ${tag("Bathrooms", i.banheiros)}
        ${tag("Garage", i.vagas)}
        <Features>${features}</Features>
        <Media>${media}</Media>
      </Details>
      <Location displayAddress="${i.endereco_logradouro ? "Street" : "Neighborhood"}">
        ${tag("Country", "BR")}
        ${tag("State", i.endereco_uf)}
        ${tag("City", i.endereco_cidade)}
        ${tag("Neighborhood", i.endereco_bairro)}
        ${tag("Address", i.endereco_logradouro)}
        ${tag("StreetNumber", i.endereco_numero)}
        ${tag("PostalCode", i.endereco_cep)}
        ${tag("Latitude", i.latitude)}
        ${tag("Longitude", i.longitude)}
      </Location>
    </Listing>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.vivareal.com/schemas/1.0/VRSync.xsd">
  <Header>
    ${tag("Provider", tenant.nome)}
    ${tag("Email", "")}
    <PublishDate>${new Date().toISOString()}</PublishDate>
  </Header>
  <Listings>${listings}</Listings>
</ListingDataFeed>`;
}
