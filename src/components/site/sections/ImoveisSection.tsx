import { Link } from "@tanstack/react-router";
import { Bed, Bath, Maximize2, MapPin, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBRL, FINALIDADE_LABEL } from "@/lib/format";
import type { LayoutKey } from "@/lib/siteSections";

type ImovelCard = {
  id: string;
  slug: string;
  titulo: string;
  finalidade: string;
  preco: number | null;
  quartos: number | null;
  banheiros: number | null;
  area_util: number | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
};

export function ImoveisSection({
  variant,
  imoveis,
  fotosMap,
}: {
  variant: LayoutKey;
  imoveis: ImovelCard[];
  fotosMap: Record<string, string>;
}) {
  const gridCols =
    variant === "boutique"
      ? "sm:grid-cols-2"
      : variant === "vitrine"
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-3";

  const cardShadow =
    variant === "boutique"
      ? "border border-border/60 shadow-none"
      : "border border-border shadow-sm hover:shadow-xl hover:shadow-primary/10";

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Imóveis em destaque</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {imoveis.length > 0
              ? `${imoveis.length} ${imoveis.length === 1 ? "opção selecionada" : "opções selecionadas"} para você`
              : "Em breve, novidades por aqui"}
          </p>
        </div>
      </div>
      {imoveis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum imóvel publicado no momento.</p>
        </div>
      ) : (
        <div className={`grid gap-6 ${gridCols}`}>
          {imoveis.map((i, idx) => {
            const featured = variant === "vitrine" && idx < 2;
            return (
              <Link
                key={i.id}
                to="/imovel/$slug"
                params={{ slug: i.slug }}
                className={`group overflow-hidden rounded-2xl bg-card transition-all duration-300 hover:-translate-y-1 ${cardShadow} ${
                  featured ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <div
                  className={`relative overflow-hidden bg-muted ${featured ? "aspect-[16/9]" : "aspect-[4/3]"}`}
                >
                  {fotosMap[i.id] ? (
                    <img
                      src={fotosMap[i.id]}
                      alt={i.titulo}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      sem foto
                    </div>
                  )}
                  <Badge className="absolute left-3 top-3 shadow-sm">
                    {FINALIDADE_LABEL[i.finalidade] ?? i.finalidade}
                  </Badge>
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-1 font-semibold">{i.titulo}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />{" "}
                    {[i.endereco_bairro, i.endereco_cidade].filter(Boolean).join(", ") || "—"}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <span className="block text-lg font-bold text-primary">
                      {formatBRL(i.preco)}
                    </span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {i.quartos != null && (
                        <span className="flex items-center gap-1">
                          <Bed className="h-3 w-3" /> {i.quartos}
                        </span>
                      )}
                      {i.banheiros != null && (
                        <span className="flex items-center gap-1">
                          <Bath className="h-3 w-3" /> {i.banheiros}
                        </span>
                      )}
                      {i.area_util != null && (
                        <span className="flex items-center gap-1">
                          <Maximize2 className="h-3 w-3" /> {i.area_util}m²
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
