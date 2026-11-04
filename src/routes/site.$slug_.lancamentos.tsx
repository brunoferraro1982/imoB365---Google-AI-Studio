import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { TenantSiteLayout, SiteSkeleton, type SiteCtx } from "@/components/site/TenantSiteLayout";
import {
  CardEmpreendimentoSite,
  useEmpreendimentosTenant,
} from "@/components/site/sections/EmpreendimentosSection";
import { MobileCtaBar, SecaoTitulo } from "@/components/site/sections/ui";
import { SiteNaoEncontrado } from "@/components/site/SiteNaoEncontrado";
import { carregarSiteCtx, useTituloSite } from "@/lib/tenantSite";

export const Route = createFileRoute("/site/$slug_/lancamentos")({
  component: TenantLancamentosPage,
  head: ({ params }) => ({
    meta: [{ title: `Lançamentos — ${params.slug}` }],
  }),
});

const FASES = [
  { k: "", label: "Todos" },
  { k: "lancamento", label: "Lançamento" },
  { k: "pre_lancamento", label: "Breve lançamento" },
  { k: "em_obras", label: "Em obras" },
  { k: "pronto", label: "Pronto" },
];

function TenantLancamentosPage() {
  const { slug } = Route.useParams();
  const [ctx, setCtx] = useState<SiteCtx | null>(null);
  const [loading, setLoading] = useState(true);
  const [fase, setFase] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setCtx(await carregarSiteCtx(slug));
      setLoading(false);
    })();
  }, [slug]);

  useTituloSite(ctx, "Lançamentos");
  const itens = useEmpreendimentosTenant(ctx?.tenantId);
  const fasesPresentes = useMemo(() => new Set((itens ?? []).map((e) => e.fase)), [itens]);
  const filtrados = (itens ?? []).filter((e) => !fase || e.fase === fase);

  if (loading) return <SiteSkeleton />;
  if (!ctx) return <SiteNaoEncontrado />;

  return (
    <TenantSiteLayout ctx={ctx}>
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <SecaoTitulo
          eyebrow="Na planta e em obras"
          titulo="Lançamentos e empreendimentos"
          subtitulo={
            itens
              ? `${itens.length} ${itens.length === 1 ? "empreendimento" : "empreendimentos"} com condições direto da construtora.`
              : undefined
          }
        />
        {itens && fasesPresentes.size > 1 && (
          <div className="glass-fosco mb-8 inline-flex flex-wrap gap-2 rounded-3xl p-2">
            {FASES.filter((f) => !f.k || fasesPresentes.has(f.k)).map((f) => (
              <button
                key={f.k || "todos"}
                type="button"
                onClick={() => setFase(f.k)}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                  fase === f.k
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-white dark:hover:bg-white/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {itens === null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/4.6] animate-pulse rounded-3xl bg-white/70" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="glass-fosco rounded-3xl py-16 text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum empreendimento publicado.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((e) => (
              <CardEmpreendimentoSite key={e.id} e={e} />
            ))}
          </div>
        )}
      </section>
      <MobileCtaBar ctx={ctx} alvo={`/site/${ctx.tenantSlug}#receber-opcoes`} />
      <div className="h-16 md:hidden" aria-hidden />
    </TenantSiteLayout>
  );
}
