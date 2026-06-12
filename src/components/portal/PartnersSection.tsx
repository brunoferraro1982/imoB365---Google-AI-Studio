import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Partner {
  id: string;
  nome: string;
  logo_url: string | null;
  site_url: string | null;
}

export function PartnersSection() {
  const [items, setItems] = useState<Partner[]>([]);

  useEffect(() => {
    void supabase
      .from("partners")
      .select("id,nome,logo_url,site_url")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => setItems((data as Partner[]) ?? []));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="py-10 border-t border-border/40">
      <div className="container max-w-4xl mx-auto px-4">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
          Construtoras e parceiras
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8">
          {items.map((p) =>
            p.logo_url ? (
              <a
                key={p.id}
                href={p.site_url ?? "#"}
                target={p.site_url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <img src={p.logo_url} alt={p.nome} className="h-10 object-contain" />
              </a>
            ) : (
              <span key={p.id} className="text-sm font-bold text-muted-foreground opacity-60">
                {p.nome}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
