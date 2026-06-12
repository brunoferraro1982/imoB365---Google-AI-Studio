import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Phone } from "lucide-react";

export const Route = createFileRoute("/consultoria")({
  head: () => ({
    meta: [
      { title: "Consultoria Imobiliária | imoB365 — Litoral Sul de SP" },
      { name: "description", content: "Administração de imóveis, gestão contratual, lançamentos exclusivos e imóveis de alto padrão em Praia Grande, Santos e São Vicente." },
    ],
  }),
  component: ConsultoriaPage,
});

interface Service {
  id: string;
  titulo: string;
  descricao: string | null;
  icone_url: string | null;
  ordem: number;
}

function ConsultoriaPage() {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    void supabase
      .from("services")
      .select("id,titulo,descricao,icone_url,ordem")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => setServices((data as Service[]) ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-14 px-4 bg-gradient-to-b from-muted/40 to-background">
        <div className="container max-w-3xl mx-auto text-center space-y-3">
          <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Consultoria e Serviços
          </span>
          <h1 className="text-3xl font-black tracking-tight">
            Soluções Imobiliárias Completas
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xl mx-auto">
            Da curadoria ao contrato, cuidamos de cada etapa para que você invista com
            tranquilidade e segurança jurídica no Litoral Sul de São Paulo.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-10 px-4">
        <div className="container max-w-4xl mx-auto">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link
                key={s.id}
                to="/contato"
                className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/30 hover:shadow-md transition-all"
              >
                {s.icone_url && (
                  <img src={s.icone_url} alt="" className="h-12 w-12 object-cover rounded-lg" />
                )}
                <div>
                  <h3 className="font-bold text-sm group-hover:text-primary transition-colors">
                    {s.titulo}
                  </h3>
                  {s.descricao && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {s.descricao}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-bold text-primary mt-auto flex items-center gap-1">
                  Saiba mais <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 bg-primary text-white text-center">
        <h2 className="text-xl font-black tracking-tight mb-2">Você tem alguma dúvida?</h2>
        <p className="text-white/80 text-sm mb-5">
          Nossa equipe está disponível 365 dias por ano para te atender.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/contato"
            className="inline-flex items-center gap-2 rounded-xl bg-white text-primary px-5 py-2.5 text-sm font-bold hover:bg-white/90 transition-colors"
          >
            Agendar Consultoria <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://wa.me/5513997794382"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition-colors"
          >
            <Phone className="h-4 w-4" /> (13) 99779-4382
          </a>
        </div>
      </section>
    </div>
  );
}
