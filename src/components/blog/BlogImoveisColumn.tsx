import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, FINALIDADE_LABEL, imovelFotoUrl } from "@/lib/format";

type Imovel = {
  id: string;
  slug: string;
  titulo: string;
  finalidade: string;
  preco: number | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_bairro: string | null;
  imovel_fotos?: { storage_path: string; capa: boolean; ordem: number }[];
};

function capaUrl(fotos: Imovel["imovel_fotos"]): string | null {
  if (!fotos || fotos.length === 0) return null;
  const ordenadas = [...fotos].sort((a, b) => {
    if (a.capa !== b.capa) return a.capa ? -1 : 1;
    return a.ordem - b.ordem;
  });
  return imovelFotoUrl(ordenadas[0].storage_path);
}

// Coluna 1 do redesign de /blog: quem chega via conteúdo orgânico também vê
// imóveis reais à venda/locação — cross-tenant de propósito (sem filtro de
// tenant), espelhando a seção "Imóveis em destaque" da home
// (src/routes/index.tsx). A imoB365 é a operadora do SaaS, não uma
// imobiliária — filtrar pelo tenant corporativo (como blog_posts faz)
// deixaria essa coluna permanentemente vazia.
export function BlogImoveisColumn({ onHasContent }: { onHasContent?: (has: boolean) => void }) {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("imoveis")
        .select(
          "id,slug,titulo,finalidade,preco,endereco_cidade,endereco_uf,endereco_bairro,imovel_fotos(storage_path,capa,ordem)",
        )
        .eq("publicado", true)
        .eq("status", "ativo")
        .in("finalidade", ["venda", "aluguel"])
        .order("updated_at", { ascending: false })
        .limit(6);
      if (cancelled) return;
      const lista = (data as Imovel[]) ?? [];
      setImoveis(lista);
      setLoading(false);
      onHasContent?.(lista.length > 0);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loading && imoveis.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        Imóveis à venda e locação
      </h2>
      <div className="space-y-3">
        {loading
          ? [1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)
          : imoveis.map((i) => {
              const url = capaUrl(i.imovel_fotos);
              return (
                <Link
                  key={i.id}
                  to="/imovel/$slug"
                  params={{ slug: i.slug }}
                  className="group block overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {url ? (
                      <img
                        src={url}
                        alt={i.titulo}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Building2 className="h-8 w-8" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                      {FINALIDADE_LABEL[i.finalidade] ?? i.finalidade}
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{i.titulo}</h3>
                    {(i.endereco_bairro || i.endereco_cidade) && (
                      <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {[i.endereco_bairro, i.endereco_cidade, i.endereco_uf]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-bold text-primary">
                      {i.preco != null ? formatBRL(Number(i.preco)) : "Sob consulta"}
                    </p>
                  </div>
                </Link>
              );
            })}
      </div>
      {!loading && imoveis.length > 0 && (
        <Link
          to="/buscar"
          className="block text-center text-xs font-semibold text-primary hover:underline"
        >
          Ver todos os imóveis →
        </Link>
      )}
    </div>
  );
}
