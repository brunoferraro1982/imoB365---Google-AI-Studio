import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getCorporateTenantId } from "@/lib/corporateTenant";

// Sitemap corporativo (páginas institucionais + blog) referenciado pelo
// /api/public/sitemap-index.xml.
//
// Domínio derivado do próprio request (origin) — NUNCA hardcodar
// "imob365.com.br": a produção roda em portal.imob365.com.br e o dev em
// localhost. Mesmo padrão já usado em sitemap-index.xml e robots.txt.
//
// Só entram aqui URLs canônicas que respondem 200 — ex.: /a-imob365 (e não
// /sobre, que faz 307 pra /a-imob365; sitemap não deve listar redirect).

// priority é a importância relativa ENTRE as páginas do próprio site
// (não é sinal de ranking do Google).
const STATIC_PATHS: { path: string; priority: string }[] = [
  { path: "/", priority: "1.0" },
  { path: "/blog", priority: "0.8" },
  { path: "/a-imob365", priority: "0.7" },
  { path: "/consultoria", priority: "0.7" },
  { path: "/calculadoras", priority: "0.7" },
  { path: "/calculadora-avaliacao", priority: "0.6" },
  { path: "/calculadora-financiamento", priority: "0.6" },
  { path: "/calculadora-itbi", priority: "0.6" },
  { path: "/calculadora-mudanca", priority: "0.6" },
  { path: "/contato", priority: "0.6" },
  { path: "/atendimento", priority: "0.6" },
  { path: "/termos", priority: "0.3" },
  { path: "/privacidade", priority: "0.3" },
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
      GET: async ({ request }) => {
        const base = new URL(request.url).origin;

        // Blog institucional pertence ao tenant corporativo (não é
        // tenant_id NULL) e usa status "publicado"/coluna publicado_em —
        // mesma fonte de verdade de blog.tsx. A versão anterior filtrava
        // por published_at/status="published"/tenant_id IS NULL, que não
        // existem no schema: o sitemap nunca listou nenhum artigo.
        const tenantId = await getCorporateTenantId();
        const { data: posts } = tenantId
          ? await supabase
              .from("blog_posts")
              .select("slug, publicado_em")
              .eq("tenant_id", tenantId)
              .eq("status", "publicado")
              .order("publicado_em", { ascending: false })
              .limit(1000)
          : { data: [] as { slug: string; publicado_em: string | null }[] };

        const urls: string[] = [
          ...STATIC_PATHS.map((u) => urlEntry(`${base}${u.path}`, u.priority)),
          ...(posts ?? []).map((p) =>
            urlEntry(
              `${base}/blog/${p.slug}`,
              "0.9",
              p.publicado_em ? p.publicado_em.slice(0, 10) : undefined,
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
