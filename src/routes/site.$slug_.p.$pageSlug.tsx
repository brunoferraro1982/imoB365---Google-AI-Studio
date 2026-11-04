import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteSkeleton, type SiteCtx } from "@/components/site/TenantSiteLayout";
import { carregarSiteCtx, useTituloSite } from "@/lib/tenantSite";
import { TenantSiteLayoutWithWidgets } from "@/components/site/SiteWidgets";

export const Route = createFileRoute("/site/$slug_/p/$pageSlug")({
  component: TenantPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.pageSlug} — ${params.slug}` },
      { property: "og:url", content: `/site/${params.slug}/p/${params.pageSlug}` },
    ],
    links: [{ rel: "canonical", href: `/site/${params.slug}/p/${params.pageSlug}` }],
  }),
});

function TenantPage() {
  const { slug, pageSlug } = Route.useParams();
  const [ctx, setCtx] = useState<SiteCtx | null>(null);
  const [page, setPage] = useState<{ titulo: string; conteudo_html: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const c = await carregarSiteCtx(slug);
      if (!c) {
        setLoading(false);
        return;
      }
      const { data: pg } = await supabase
        .from("tenant_pages")
        .select("titulo,conteudo_html")
        .eq("tenant_id", c.tenantId)
        .eq("slug", pageSlug)
        .eq("publicada", true)
        .maybeSingle();
      setCtx(c);
      setPage(pg ?? null);
      setLoading(false);
    })();
  }, [slug, pageSlug]);

  useTituloSite(ctx, page?.titulo);

  if (loading) return <SiteSkeleton />;
  if (!ctx || !page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl font-bold">Página não encontrada</h1>
        <Link to="/site/$slug" params={{ slug }} className="text-sm text-primary hover:underline">
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <TenantSiteLayoutWithWidgets ctx={ctx}>
      <article className="glass-fosco mx-auto max-w-3xl rounded-[32px] p-6 md:p-10">
        <h1 className="font-brand-display mb-6 text-3xl font-extrabold tracking-tight md:text-4xl">
          {page.titulo}
        </h1>
        <div
          className="prose prose-sm max-w-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: page.conteudo_html }}
        />
      </article>
    </TenantSiteLayoutWithWidgets>
  );
}
