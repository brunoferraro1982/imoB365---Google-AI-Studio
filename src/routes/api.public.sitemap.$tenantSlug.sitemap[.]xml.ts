import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/sitemap/$tenantSlug/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { tenantSlug } = params;
        const { data: tenant } = await supabaseAdmin
          .from("tenants").select("id,slug").eq("slug", tenantSlug).maybeSingle();
        if (!tenant) return new Response("Not found", { status: 404 });

        const { data: site } = await supabaseAdmin
          .from("tenant_site_settings").select("publicado").eq("tenant_id", tenant.id).maybeSingle();
        if (!site?.publicado) return new Response("Site não publicado", { status: 404 });

        const origin = new URL(request.url).origin;
        const base = `${origin}/site/${tenant.slug}`;

        const [{ data: imoveis }, { data: pages }, { data: corretores }] = await Promise.all([
          supabaseAdmin.from("imoveis").select("slug,updated_at")
            .eq("tenant_id", tenant.id).eq("publicado", true).eq("status", "ativo").limit(5000),
          supabaseAdmin.from("tenant_pages").select("slug,updated_at")
            .eq("tenant_id", tenant.id).eq("publicada", true),
          supabaseAdmin.from("corretores").select("slug,updated_at")
            .eq("tenant_id", tenant.id).eq("ativo", true).eq("publico", true),
        ]);

        const urls: string[] = [
          `<url><loc>${base}</loc><priority>1.0</priority></url>`,
          `<url><loc>${origin}/buscar</loc><priority>0.8</priority></url>`,
        ];
        for (const p of pages ?? []) {
          urls.push(`<url><loc>${base}/p/${p.slug}</loc><lastmod>${p.updated_at}</lastmod></url>`);
        }
        for (const i of imoveis ?? []) {
          urls.push(`<url><loc>${origin}/imovel/${i.slug}</loc><lastmod>${i.updated_at}</lastmod><priority>0.9</priority></url>`);
        }
        for (const c of corretores ?? []) {
          urls.push(`<url><loc>${origin}/corretor/${c.slug}</loc><lastmod>${c.updated_at}</lastmod></url>`);
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});