import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TenantSiteLayout, type SiteCtx } from "@/components/site/TenantSiteLayout";

export const Route = createFileRoute("/site/$slug/p/$pageSlug")({
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
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id,slug,nome")
        .eq("slug", slug)
        .maybeSingle();
      if (!tenant) {
        setLoading(false);
        return;
      }
      const [{ data: cfg }, { data: pages }, { data: pg }] = await Promise.all([
        supabase
          .from("tenant_site_settings")
          .select("*")
          .eq("tenant_id", tenant.id)
          .eq("publicado", true)
          .maybeSingle(),
        supabase
          .from("tenant_pages")
          .select("slug,titulo")
          .eq("tenant_id", tenant.id)
          .eq("publicada", true)
          .order("ordem"),
        supabase
          .from("tenant_pages")
          .select("titulo,conteudo_html")
          .eq("tenant_id", tenant.id)
          .eq("slug", pageSlug)
          .eq("publicada", true)
          .maybeSingle(),
      ]);
      if (!cfg) {
        setLoading(false);
        return;
      }
      setCtx({
        tenantSlug: tenant.slug,
        tenantNome: tenant.nome,
        settings: cfg,
        pages: (pages ?? []) as any,
      });
      setPage(pg ?? null);
      setLoading(false);
    })();
  }, [slug, pageSlug]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
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
    <TenantSiteLayout ctx={ctx}>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">{page.titulo}</h1>
        <div
          className="prose prose-sm max-w-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: page.conteudo_html }}
        />
      </article>
    </TenantSiteLayout>
  );
}
