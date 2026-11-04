import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { TenantSiteLayout, SiteSkeleton } from "@/components/site/TenantSiteLayout";
import { CardImovelSite } from "@/components/site/sections/ImoveisSection";
import { MobileCtaBar, SecaoTitulo } from "@/components/site/sections/ui";
import { SiteNaoEncontrado } from "@/components/site/SiteNaoEncontrado";
import { useImoveisSite, useSiteCtx, useTituloSite } from "@/lib/tenantSite";
import { FINALIDADE_LABEL } from "@/lib/format";

export const Route = createFileRoute("/site/$slug_/imoveis")({
  component: TenantImoveisPage,
  head: ({ params }) => ({
    meta: [{ title: `Imóveis — ${params.slug}` }],
  }),
});

function TenantImoveisPage() {
  const { slug } = Route.useParams();
  const ctxQuery = useSiteCtx(slug);
  const ctx = ctxQuery.data ?? null;
  const imoveisQuery = useImoveisSite(ctx?.tenantId);
  const imoveis = useMemo(() => imoveisQuery.data?.imoveis ?? [], [imoveisQuery.data]);
  const fotosMap = imoveisQuery.data?.fotosMap ?? {};
  const loading = ctxQuery.isPending || (!!ctx && imoveisQuery.isPending);
  const [busca, setBusca] = useState("");
  const [finalidade, setFinalidade] = useState<string>("");

  useTituloSite(ctx, "Imóveis");

  const finalidades = useMemo(
    () => Array.from(new Set(imoveis.map((i) => i.finalidade).filter(Boolean))),
    [imoveis],
  );
  const filtrados = useMemo(() => {
    const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    return imoveis.filter((i) => {
      if (finalidade && i.finalidade !== finalidade) return false;
      if (!q) return true;
      return [i.titulo, i.endereco_bairro, i.endereco_cidade]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(q);
    });
  }, [imoveis, busca, finalidade]);

  if (loading) return <SiteSkeleton />;
  if (!ctx) return <SiteNaoEncontrado />;

  return (
    <TenantSiteLayout ctx={ctx}>
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <SecaoTitulo
          eyebrow="Carteira completa"
          titulo="Todos os imóveis"
          subtitulo={`${imoveis.length} ${imoveis.length === 1 ? "imóvel publicado" : "imóveis publicados"}`}
        />
        {imoveis.length > 0 && (
          <div className="glass-fosco mb-8 flex flex-col gap-3 rounded-3xl p-3 sm:flex-row sm:items-center">
            <label className="flex flex-1 items-center gap-2 rounded-2xl bg-white/70 px-3.5 py-2.5 dark:bg-white/5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por bairro, cidade ou nome"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Buscar imóveis"
              />
            </label>
            {finalidades.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {["", ...finalidades].map((f) => (
                  <button
                    key={f || "todos"}
                    type="button"
                    onClick={() => setFinalidade(f)}
                    className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                      finalidade === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/70 text-foreground/80 hover:bg-white dark:bg-white/5"
                    }`}
                  >
                    {f ? (FINALIDADE_LABEL[f] ?? f) : "Todos"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {filtrados.length === 0 ? (
          <div className="glass-fosco rounded-3xl py-16 text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {imoveis.length
                ? "Nenhum imóvel com esse filtro."
                : "Nenhum imóvel publicado no momento."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((i) => (
              <CardImovelSite key={i.id} imovel={i} foto={fotosMap[i.id]} />
            ))}
          </div>
        )}
      </section>
      <MobileCtaBar ctx={ctx} alvo={`/site/${ctx.tenantSlug}#receber-opcoes`} />
      <div className="h-16 md:hidden" aria-hidden />
    </TenantSiteLayout>
  );
}
