import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit, getClientIpFromRequest } from "@/lib/rateLimit";

// Catálogo de produtos (vertical "Real Estate") pro Commerce Manager da
// Meta — o tenant cola esta URL como "Data Feed" agendado no próprio painel
// da Meta (mesmo modelo mental já usado pelos feeds VivaReal/ZAP/OLX: o
// portal/plataforma é quem periodicamente busca essa URL, nenhuma automação
// nossa empurra dado nenhum). Alimenta Dynamic Ads e, quando o anunciante
// tem posicionamento habilitado, também pode aparecer no Marketplace —
// mecanismo oficial da própria Meta, sem relação com scraping.
export const Route = createFileRoute("/api/public/feeds/$tenantSlug/meta-catalog.csv")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const rl = checkRateLimit(`feed:${getClientIpFromRequest(request)}`, {
          max: 30,
          windowMs: 60_000,
        });
        if (!rl.allowed) {
          return new Response("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": String(rl.retryAfterSeconds) },
          });
        }

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
          .eq("portal_slug", "meta")
          .eq("enabled", true)
          .maybeSingle();
        if (!feed) return new Response("Feed disabled", { status: 404 });

        const { data: imoveis } = await supabaseAdmin
          .from("imoveis")
          .select(
            "id,slug,titulo,descricao,finalidade,tipo,preco,area_util,area_total,quartos,banheiros,endereco_logradouro,endereco_numero,endereco_bairro,endereco_cidade,endereco_uf,endereco_cep,latitude,longitude,updated_at,codigo_interno",
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

        const capaMap = new Map<string, string>();
        for (const f of fotos ?? []) {
          if (capaMap.has(f.imovel_id)) continue;
          capaMap.set(
            f.imovel_id,
            supabaseAdmin.storage.from("imovel-fotos").getPublicUrl(f.storage_path).data.publicUrl,
          );
        }

        const origin = new URL(request.url).origin;
        const csv = buildMetaCatalogCsv(imoveis ?? [], capaMap, origin);

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
            .eq("portal_slug", "meta");
        } catch {}

        return new Response(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});

const PROPERTY_TYPE_META: Record<string, string> = {
  apartamento: "apartment",
  casa: "house",
  cobertura: "apartment",
  terreno: "land",
  comercial: "commercial",
  galpao: "commercial",
  chacara: "house",
  outro: "house",
};
const LISTING_TYPE_META: Record<string, string> = {
  venda: "for_sale",
  aluguel: "for_rent",
  temporada: "for_rent",
};

function csvField(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADER = [
  "listing_id",
  "availability",
  "price",
  "property_type",
  "listing_type",
  "name",
  "description",
  "url",
  "address",
  "latitude",
  "longitude",
  "num_beds",
  "num_baths",
  "area_size",
  "image[0].url",
];

function buildMetaCatalogCsv(
  imoveis: any[],
  capaMap: Map<string, string>,
  baseUrl: string,
): string {
  const linhas = imoveis.map((i) => {
    const endereco = [
      i.endereco_logradouro,
      i.endereco_numero,
      i.endereco_bairro,
      i.endereco_cidade,
      i.endereco_uf,
    ]
      .filter(Boolean)
      .join(", ");
    const row = [
      i.codigo_interno || i.id,
      "in stock",
      i.preco != null ? `BRL ${i.preco}` : "",
      PROPERTY_TYPE_META[i.tipo] ?? "house",
      LISTING_TYPE_META[i.finalidade] ?? "for_sale",
      i.titulo,
      i.descricao,
      `${baseUrl}/imovel/${i.slug}`,
      endereco,
      i.latitude ?? "",
      i.longitude ?? "",
      i.quartos ?? "",
      i.banheiros ?? "",
      i.area_util ?? i.area_total ?? "",
      capaMap.get(i.id) ?? "",
    ];
    return row.map(csvField).join(",");
  });

  return [HEADER.join(","), ...linhas].join("\n") + "\n";
}
