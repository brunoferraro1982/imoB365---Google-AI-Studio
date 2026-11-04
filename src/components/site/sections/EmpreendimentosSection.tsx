import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SecaoTitulo } from "./ui";

export type EmpreendimentoCard = {
  id: string;
  slug: string;
  nome: string;
  fase: string | null;
  construtora: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  entrega_prevista: string | null;
  fotos_urls: string[] | null;
};

const FASE_LABEL: Record<string, string> = {
  lancamento: "Lançamento",
  pre_lancamento: "Breve lançamento",
  em_obras: "Em obras",
  pronto: "Pronto para morar",
};

/** Empreendimentos publicados do tenant, mais recentes primeiro. */
export function useEmpreendimentosTenant(tenantId: string | undefined, limite?: number) {
  const [itens, setItens] = useState<EmpreendimentoCard[] | null>(null);
  useEffect(() => {
    if (!tenantId) return;
    let q = supabase
      .from("empreendimentos")
      .select(
        "id,slug,nome,fase,construtora,endereco_bairro,endereco_cidade,entrega_prevista,fotos_urls",
      )
      .eq("tenant_id", tenantId)
      .eq("publicado", true)
      .order("created_at", { ascending: false });
    if (limite) q = q.limit(limite);
    q.then(({ data }) => setItens((data as EmpreendimentoCard[]) ?? []));
  }, [tenantId, limite]);
  return itens;
}

export function CardEmpreendimentoSite({ e }: { e: EmpreendimentoCard }) {
  const capa = e.fotos_urls?.[0];
  const local = [e.endereco_bairro, e.endereco_cidade].filter(Boolean).join(", ");
  return (
    <Link
      to="/empreendimento/$slug"
      params={{ slug: e.slug }}
      className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-muted shadow-[0_14px_40px_-24px_rgba(15,23,42,0.5)] transition duration-300 hover:-translate-y-1 sm:aspect-[4/4.6]"
    >
      {capa ? (
        <img
          src={capa}
          alt={e.nome}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground/50">
          <Building2 className="h-10 w-10" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      {e.fase && (
        <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-white/85 px-2.5 py-1 text-[11px] font-bold text-foreground backdrop-blur-md">
          {FASE_LABEL[e.fase] ?? e.fase}
        </span>
      )}
      <div className="glass-escuro relative m-3 rounded-2xl p-4 text-white">
        <h3 className="font-brand-display line-clamp-1 text-lg font-extrabold">{e.nome}</h3>
        {e.construtora && <p className="text-xs text-white/65">por {e.construtora}</p>}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/80">
          {local && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{local}</span>
            </span>
          )}
          {e.entrega_prevista && e.fase !== "pronto" && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Entrega{" "}
              {new Date(e.entrega_prevista).toLocaleDateString("pt-BR", {
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

const LIMITE_HOME = 6;

export function EmpreendimentosSection({
  tenantId,
  tenantSlug,
  total,
  compact,
}: {
  tenantId: string;
  tenantSlug: string;
  total: number;
  compact?: boolean;
}) {
  const itens = useEmpreendimentosTenant(total > 0 ? tenantId : undefined, LIMITE_HOME);
  if (total === 0 || (itens && itens.length === 0)) return null;
  const lista = compact ? (itens ?? []).slice(0, 2) : (itens ?? []);

  return (
    <div className="@container">
      <SecaoTitulo
        compact={compact}
        eyebrow="Na planta e em obras"
        titulo="Lançamentos e empreendimentos"
        subtitulo="Condições direto com a construtora, tabela atualizada e plantas com quem acompanha cada obra."
        acao={
          !compact && total > LIMITE_HOME ? (
            <Link
              to="/site/$slug/lancamentos"
              params={{ slug: tenantSlug }}
              className="glass-fosco inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-white"
            >
              Ver todos os {total} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null
        }
      />
      <div className={`grid gap-6 ${compact ? "" : "@md:grid-cols-2 @3xl:grid-cols-3"}`}>
        {itens === null
          ? Array.from({ length: compact ? 2 : 3 }).map((_, i) => (
              <div key={i} className="aspect-[4/4.6] animate-pulse rounded-3xl bg-white/70" />
            ))
          : lista.map((e) => <CardEmpreendimentoSite key={e.id} e={e} />)}
      </div>
    </div>
  );
}
