import { Link } from "@tanstack/react-router";
import { ArrowRight, Bath, BedDouble, Building2, Car, MapPin, Maximize2 } from "lucide-react";
import { formatBRL, FINALIDADE_LABEL } from "@/lib/format";
import type { LayoutKey } from "@/lib/siteSections";
import { SecaoTitulo } from "./ui";

export type ImovelCard = {
  id: string;
  slug: string;
  titulo: string;
  finalidade: string;
  preco: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas?: number | null;
  area_util: number | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
};

/** Card de imóvel no padrão Liquid Glass (home e /site/$slug/imoveis). */
export function CardImovelSite({
  imovel: i,
  foto,
  destaque,
}: {
  imovel: ImovelCard;
  foto?: string;
  destaque?: boolean;
}) {
  const local = [i.endereco_bairro, i.endereco_cidade].filter(Boolean).join(", ");
  return (
    <Link
      to="/imovel/$slug"
      params={{ slug: i.slug }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-[0_14px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-white/5"
    >
      <div
        className={`relative w-full overflow-hidden bg-muted ${destaque ? "aspect-[16/10]" : "aspect-[4/3]"}`}
      >
        {foto ? (
          <img
            src={foto}
            alt={i.titulo}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground/50">
            <Building2 className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
          {FINALIDADE_LABEL[i.finalidade] ?? i.finalidade}
        </span>
        <span className="absolute bottom-3 left-3 rounded-xl border border-white/50 bg-white/85 px-3 py-1.5 text-[15px] font-extrabold text-foreground shadow-sm backdrop-blur-md">
          {i.preco != null ? formatBRL(i.preco) : "Sob consulta"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">{i.titulo}</h3>
        {local && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{local}</span>
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-x-3.5 gap-y-1 pt-3 text-xs text-muted-foreground">
          {i.quartos != null && i.quartos > 0 && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" /> {i.quartos}{" "}
              {i.quartos === 1 ? "dorm." : "dorms."}
            </span>
          )}
          {i.banheiros != null && i.banheiros > 0 && (
            <span className="flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" /> {i.banheiros}
            </span>
          )}
          {i.vagas != null && i.vagas > 0 && (
            <span className="flex items-center gap-1">
              <Car className="h-3.5 w-3.5" /> {i.vagas}
            </span>
          )}
          {i.area_util != null && (
            <span className="flex items-center gap-1">
              <Maximize2 className="h-3.5 w-3.5" /> {Number(i.area_util).toLocaleString("pt-BR")} m²
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ImoveisSection({
  variant,
  imoveis,
  fotosMap,
  compact,
  totalCount,
  tenantSlug,
}: {
  variant: LayoutKey;
  imoveis: ImovelCard[];
  fotosMap: Record<string, string>;
  /** Renderização em 1 coluna, para quando o bloco está numa área lateral estreita (layout 'amplo'). */
  compact?: boolean;
  /** Contagem real de imóveis publicados do tenant — pode ser maior que
   * `imoveis.length` (a home só busca uma amostra em destaque). */
  totalCount?: number;
  tenantSlug?: string;
}) {
  // Container query: responde à largura real do espaço (o layout 'amplo'
  // pode colocar a seção numa coluna mais estreita que a janela).
  const gridCols = compact
    ? ""
    : variant === "boutique"
      ? "@md:grid-cols-2"
      : "@md:grid-cols-2 @3xl:grid-cols-3";
  const total = totalCount ?? imoveis.length;
  const verTodos =
    !compact && tenantSlug && total > imoveis.length ? (
      <Link
        to="/site/$slug/imoveis"
        params={{ slug: tenantSlug }}
        className="glass-fosco inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-white"
      >
        Ver todos os {total} imóveis <ArrowRight className="h-4 w-4" />
      </Link>
    ) : null;

  return (
    <div className="@container">
      <SecaoTitulo
        compact={compact}
        eyebrow="Carteira"
        titulo="Imóveis em destaque"
        subtitulo={
          imoveis.length > 0
            ? "Selecionados e acompanhados de perto — agende sua visita pelo WhatsApp."
            : "Em breve, novidades por aqui."
        }
        acao={verTodos}
      />
      {imoveis.length === 0 ? (
        <div className="glass-fosco rounded-3xl py-16 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum imóvel publicado no momento.</p>
        </div>
      ) : (
        <div className={`grid gap-6 ${gridCols}`}>
          {(compact ? imoveis.slice(0, 4) : imoveis).map((i) => (
            <CardImovelSite key={i.id} imovel={i} foto={fotosMap[i.id]} />
          ))}
        </div>
      )}
    </div>
  );
}
