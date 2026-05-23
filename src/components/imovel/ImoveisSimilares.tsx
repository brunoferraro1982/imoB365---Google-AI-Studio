import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bed, Bath, Car, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

type Similar = {
  id: string;
  slug: string;
  titulo: string;
  preco: number;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  area_util: number | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  capa: string | null;
};

export function ImoveisSimilares({
  imovelId,
  tipo,
  finalidade,
  preco,
  cidade,
}: {
  imovelId: string;
  tipo: string;
  finalidade: string;
  preco: number;
  cidade: string | null;
}) {
  const [items, setItems] = useState<Similar[] | null>(null);

  useEffect(() => {
    (async () => {
      const min = preco * 0.7;
      const max = preco * 1.3;
      let q = (supabase as any)
        .from("imoveis")
        .select("id,slug,titulo,preco,quartos,banheiros,vagas,area_util,endereco_bairro,endereco_cidade,imovel_fotos(storage_path,capa,ordem)")
        .eq("publicado", true)
        .eq("status", "ativo")
        .eq("tipo", tipo)
        .eq("finalidade", finalidade)
        .neq("id", imovelId)
        .gte("preco", min)
        .lte("preco", max)
        .limit(6);
      if (cidade) q = q.ilike("endereco_cidade", cidade.trim());
      const { data } = await q;
      const mapped: Similar[] = (data ?? []).map((i: any) => {
        const capa = (i.imovel_fotos ?? []).sort((a: any, b: any) => Number(b.capa) - Number(a.capa) || (a.ordem ?? 0) - (b.ordem ?? 0))[0];
        return { ...i, capa: capa?.storage_path ?? null };
      });
      setItems(mapped);
    })();
  }, [imovelId, tipo, finalidade, preco, cidade]);

  if (!items || items.length === 0) return null;

  function publicUrl(path: string) {
    return supabase.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl;
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Imóveis similares</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <Link
            key={i.id}
            to="/imovel/$slug"
            params={{ slug: i.slug }}
            className="group overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-md"
          >
            <div className="aspect-[4/3] overflow-hidden bg-muted">
              {i.capa ? (
                <img src={publicUrl(i.capa)} alt={i.titulo} className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : null}
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-primary">{formatBRL(i.preco)}</p>
              <h3 className="mt-1 line-clamp-2 text-sm font-medium">{i.titulo}</h3>
              {(i.endereco_bairro || i.endereco_cidade) && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {[i.endereco_bairro, i.endereco_cidade].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {i.quartos != null && <span className="inline-flex items-center gap-1"><Bed className="h-3 w-3" />{i.quartos}</span>}
                {i.banheiros != null && <span className="inline-flex items-center gap-1"><Bath className="h-3 w-3" />{i.banheiros}</span>}
                {i.vagas != null && <span className="inline-flex items-center gap-1"><Car className="h-3 w-3" />{i.vagas}</span>}
                {i.area_util != null && <span className="inline-flex items-center gap-1"><Maximize2 className="h-3 w-3" />{i.area_util}m²</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}