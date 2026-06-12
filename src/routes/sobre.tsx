import { createFileRoute, Link } from "@tanstack/react-router";
import { PartnersSection } from "@/components/portal/PartnersSection";
import { TestimonialsSection } from "@/components/portal/TestimonialsSection";
import { Building2, BarChart3, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre a imoB365 | Inteligência Imobiliária no Litoral Sul de SP" },
      { name: "description", content: "Consultoria especializada em ativos de alto padrão em Praia Grande, Santos e São Vicente. 365 dias por ano para garantir que cada oportunidade seja capturada no momento certo." },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-muted/40 to-background">
        <div className="container max-w-3xl mx-auto text-center space-y-4">
          <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Sobre a imoB365
          </span>
          <h1 className="text-3xl font-black tracking-tight">
            Inteligência Estratégica no Mercado Imobiliário de Alto Padrão
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            A imoB365 nasceu para preencher uma lacuna no mercado do Litoral Sul de São Paulo:
            a necessidade de uma consultoria que entenda o imóvel não apenas como moradia,
            mas como um <strong>ativo estratégico</strong>. Operamos 365 dias por ano em
            Santos, Praia Grande e São Vicente.
          </p>
        </div>
      </section>

      {/* 3 Pilares */}
      <section className="py-12 px-4">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-lg font-black tracking-tight text-center mb-8">Nossa Abordagem</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: BarChart3,
                titulo: "Dados e Performance",
                desc: "Analisamos o m² real, histórico de valorização e potencial de ROI para cada ativo.",
              },
              {
                icon: ShieldCheck,
                titulo: "Curadoria de Luxo",
                desc: "Selecionamos apenas empreendimentos com rigorosos padrões de acabamento, localização e liquidez.",
              },
              {
                icon: Building2,
                titulo: "Tecnologia e Transparência",
                desc: "Ferramentas modernas para facilitar a jornada de compra e gestão com segurança jurídica total.",
              },
            ].map((p) => (
              <div key={p.titulo} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-sm">{p.titulo}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 bg-primary text-white">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { valor: "365", label: "Dias por ano atendendo" },
              { valor: "3", label: "Cidades no Litoral Sul" },
              { valor: "R$ 3MI+", label: "Portfólio disponível" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-black">{s.valor}</p>
                <p className="text-xs text-white/70 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Partners */}
      <PartnersSection />

      {/* CTA */}
      <section className="py-12 px-4 text-center">
        <h2 className="text-lg font-black tracking-tight mb-3">Pronto para encontrar seu ativo?</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Fale com nossa equipe ou veja os imóveis disponíveis no portal.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/contato"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
          >
            Agendar Consultoria <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/buscar"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold hover:bg-muted transition-colors"
          >
            Ver Imóveis
          </Link>
        </div>
      </section>
    </div>
  );
}
