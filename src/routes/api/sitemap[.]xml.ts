import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const BASE = "https://imob365.com.br";

const STATIC_URLS = [
  { loc: `${BASE}/`, priority: "1.0" },
  { loc: `${BASE}/sobre`, priority: "0.8" },
  { loc: `${BASE}/blog`, priority: "0.8" },
  { loc: `${BASE}/consultoria`, priority: "0.7" },
];

function urlEntry(loc: string, priority?: string, lastmod?: string) {
  const parts = [`<loc>${loc}</loc>`];
  if (lastmod) parts.push(`<lastmod>${lastmod}</lastmod>`);
  if (priority) parts.push(`<priority>${priority}</priority>`);
  return `<url>${parts.join("")}</url>`;
}

export const Route = createFileRoute("/api/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { data: posts } = await supabase
          .from("blog_posts")
          .select("slug, published_at")
          .eq("status", "published")
          .is("tenant_id", null)
          .order("published_at", { ascending: false })
          .limit(1000);

        const urls: string[] = [
          ...STATIC_URLS.map((u) => urlEntry(u.loc, u.priority)),
          ...(posts ?? []).map((p) =>
            urlEntry(
              `${BASE}/blog/${p.slug}`,
              "0.9",
              p.published_at ? p.published_at.slice(0, 10) : undefined,
            ),
          ),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

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
