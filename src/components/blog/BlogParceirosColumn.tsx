import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building, Factory, MapPin, MessageCircleQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CORPORATE_TENANT_SLUG } from "@/lib/corporateTenant";
import { Button } from "@/components/ui/button";

type Imobiliaria = {
  id: string;
  slug: string;
  nome: string;
  logoUrl: string | null;
  regiao: string | null;
};

type Construtora = {
  id: string;
  slug: string;
  nome: string;
  logo_url: string | null;
};

// Coluna 3 do redesign de /blog: imobiliárias/corretores parceiros (nível
// de agência — não existe hoje curadoria cross-tenant de corretor
// individual, ver plano) + construtoras parceiras. Mesmas queries já
// usadas e validadas em produção pela home (src/routes/index.tsx) e pelo
// rodapé (ConstrutorasMarquee em site-layout.tsx) — só reduzidas/limitadas
// pro espaço de uma sidebar.
export function BlogParceirosColumn({ onHasContent }: { onHasContent?: (has: boolean) => void }) {
  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([]);
  const [construtoras, setConstrutoras] = useState<Construtora[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: ts }, { data: cs }] = await Promise.all([
        supabase
          .from("tenants")
          .select("id,slug,nome,tema,cidades_atuacao,regiao_atuacao")
          .in("status", ["active", "trial"])
          .neq("slug", CORPORATE_TENANT_SLUG)
          .eq("exibir_na_home", true)
          .limit(4),
        supabase
          .from("construtoras")
          .select("id,slug,nome,logo_url")
          .eq("ativo", true)
          .eq("exibir_no_rodape", true)
          .order("nome")
          .limit(4),
      ]);
      if (cancelled) return;
      const imobList = ((ts as any[]) ?? []).map((t) => ({
        id: t.id,
        slug: t.slug,
        nome: t.nome,
        logoUrl: (t.tema as { logo_url?: string } | null)?.logo_url ?? null,
        regiao: t.regiao_atuacao || (t.cidades_atuacao?.[0] ?? null),
      }));
      setImobiliarias(imobList);
      setConstrutoras((cs as Construtora[]) ?? []);
      setLoading(false);
      // O CTA "Fale com a gente" abaixo é sempre renderizado, independente
      // de haver imobiliárias/construtoras cadastradas — esta coluna nunca
      // fica vazia de verdade, então sempre reporta "tem conteúdo".
      onHasContent?.(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {(loading || imobiliarias.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Imobiliárias &amp; Corretores Parceiros
          </h2>
          <div className="space-y-2">
            {loading
              ? [1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                ))
              : imobiliarias.map((t) => (
                  <Link
                    key={t.id}
                    to="/site/$slug"
                    params={{ slug: t.slug }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm"
                  >
                    {t.logoUrl ? (
                      <img
                        src={t.logoUrl}
                        alt={t.nome}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Building className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.nome}</p>
                      {t.regiao && (
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {t.regiao}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      )}

      {(loading || construtoras.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Construtoras Parceiras
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {loading
              ? [1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                ))
              : construtoras.map((c) => (
                  <Link
                    key={c.id}
                    to="/construtora/$slug"
                    params={{ slug: c.slug }}
                    title={c.nome}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center transition hover:border-primary/40 hover:shadow-sm"
                  >
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.nome} className="h-8 w-auto object-contain" />
                    ) : (
                      <Factory className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className="line-clamp-1 text-[11px] font-medium">{c.nome}</span>
                  </Link>
                ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center">
        <MessageCircleQuestion className="mx-auto h-6 w-6 text-primary" />
        <p className="mt-2 text-sm font-semibold">Precisa de ajuda?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fale com a gente e encontre o imóvel ideal pra você.
        </p>
        <Button size="sm" className="mt-3 w-full" asChild>
          <Link to="/consultoria">Fale com a gente</Link>
        </Button>
      </div>
    </div>
  );
}
