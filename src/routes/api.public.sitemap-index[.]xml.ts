import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Índice raiz de sitemaps: referencia o sitemap corporativo (páginas
// institucionais + blog do tenant_id=null, já existente em
// /api/sitemap.xml) e o sitemap de cada tenant com o site publicado (já
// existente em /api/public/sitemap/$tenantSlug/sitemap.xml) — nenhum dos
// dois é reimplementado aqui, só listados.
//
// tenant_site_settings não tem FK declarada pra tenants (Relationships: []
// em types.ts), então o embed do PostgREST (`tenants(slug)`) não funciona
// — duas queries sequenciais em vez de um select com join.
export const Route = createFileRoute("/api/public/sitemap-index.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;

        const { data: sites } = await supabaseAdmin
          .from("tenant_site_settings")
          .select("tenant_id")
          .eq("publicado", true);
        const tenantIds = (sites ?? []).map((s) => s.tenant_id);

        const { data: tenants } =
          tenantIds.length > 0
            ? await supabaseAdmin.from("tenants").select("slug").in("id", tenantIds)
            : { data: [] as { slug: string }[] };

        const entries = [
          `<sitemap><loc>${origin}/api/sitemap.xml</loc></sitemap>`,
          ...(tenants ?? []).map(
            (t) =>
              `<sitemap><loc>${origin}/api/public/sitemap/${t.slug}/sitemap.xml</loc></sitemap>`,
          ),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
