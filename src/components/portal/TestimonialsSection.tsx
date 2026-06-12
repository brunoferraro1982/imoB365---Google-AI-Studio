import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Quote } from "lucide-react";

interface Testimonial {
  id: string;
  nome: string;
  cargo: string | null;
  empresa: string | null;
  depoimento: string;
  foto_url: string | null;
}

export function TestimonialsSection() {
  const [items, setItems] = useState<Testimonial[]>([]);

  useEffect(() => {
    void supabase
      .from("testimonials")
      .select("id,nome,cargo,empresa,depoimento,foto_url")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => setItems((data as Testimonial[]) ?? []));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="py-14 bg-muted/30">
      <div className="container max-w-5xl mx-auto px-4">
        <h2 className="text-xl font-black tracking-tight text-center mb-8">
          O que dizem nossos clientes
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
          {items.map((t) => (
            <div key={t.id} className="bg-card rounded-2xl p-5 border border-border/60 space-y-3">
              <Quote className="h-6 w-6 text-primary/40" />
              <p className="text-sm text-foreground/80 leading-relaxed italic">
                "{t.depoimento}"
              </p>
              <div className="flex items-center gap-3 pt-1">
                {t.foto_url ? (
                  <img src={t.foto_url} alt={t.nome} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {t.nome[0]}
                  </div>
                )}
                <div>
                  <p className="font-bold text-xs">{t.nome}</p>
                  {(t.cargo || t.empresa) && (
                    <p className="text-[10px] text-muted-foreground">
                      {[t.cargo, t.empresa].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
