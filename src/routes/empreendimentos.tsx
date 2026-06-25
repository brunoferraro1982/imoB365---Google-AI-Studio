import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building, MapPin, Calendar, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/empreendimentos")({
  component: EmpreendimentosPublic,
});

type Empreend = {
  id: string;
  slug: string;
  nome: string;
  construtora: string | null;
  fase: string;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  entrega_prevista: string | null;
  unidades_total: number | null;
  fotos_urls: string[];
  descricao: string | null;
};

const FASE_LABEL: Record<string, string> = {
  lancamento: "Lançamento",
  em_obras: "Em obras",
  pronto: "Pronto",
  pre_lancamento: "Pré-lançamento",
};

const FASE_COLOR: Record<string, string> = {
  lancamento: "bg-emerald-500",
  pre_lancamento: "bg-amber-500",
  em_obras: "bg-blue-500",
  pronto: "bg-primary",
};

function EmpreendimentosPublic() {
  const [items, setItems] = useState<Empreend[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("empreendimentos")
        .select(
          "id,slug,nome,construtora,fase,endereco_bairro,endereco_cidade,endereco_uf,entrega_prevista,unidades_total,fotos_urls,descricao",
        )
        .eq("publicado", true)
        .order("created_at", { ascending: false });
      setItems((data as Empreend[]) ?? []);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Empreendimentos e Lançamentos
          </h1>
          <p className="mt-2 text-muted-foreground">
            Novos empreendimentos das imobiliárias parceiras da imoB365.
          </p>
        </div>

        {items === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Landmark className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h2 className="text-xl font-semibold">Nenhum empreendimento publicado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Em breve novos lançamentos estarão disponíveis.
            </p>
            <Link to="/" className="mt-4 text-primary hover:underline">
              Voltar para a home
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((e) => {
              const foto = e.fotos_urls?.[0] ?? null;
              return (
                <Link
                  key={e.id}
                  to="/empreendimento/$slug"
                  params={{ slug: e.slug }}
                  className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                    {foto ? (
                      <img
                        src={foto}
                        alt={e.nome}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Landmark className="h-10 w-10" />
                      </div>
                    )}
                    <span
                      className={`absolute left-3 top-3 rounded-md px-2 py-1 text-xs font-semibold text-white shadow ${FASE_COLOR[e.fase] ?? "bg-primary"}`}
                    >
                      {FASE_LABEL[e.fase] ?? e.fase}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-1 text-sm font-semibold">{e.nome}</h3>
                    {e.construtora && (
                      <p className="mt-0.5 text-xs text-muted-foreground">por {e.construtora}</p>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[e.endereco_bairro, e.endereco_cidade, e.endereco_uf]
                        .filter(Boolean)
                        .join(", ") || "Localização a definir"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {e.unidades_total != null && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {e.unidades_total} unidades
                        </span>
                      )}
                      {e.entrega_prevista && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(e.entrega_prevista).toLocaleDateString("pt-BR", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    {e.descricao && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {e.descricao}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
