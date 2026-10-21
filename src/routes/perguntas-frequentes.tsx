import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, BookOpen, ChevronDown, Search, Sparkles } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { seoHead, getSeoConfig } from "@/lib/seo";
import { FAQ_CATEGORIAS, FAQ_MERCADO, buscarFaq, type FaqItem } from "@/content/faqMercado";

// Guia público e indexável de perguntas frequentes sobre mercado imobiliário.
// Mesma fonte (src/content/faqMercado.ts) que o assistente de IA usa para
// responder instantaneamente — a página serve também de "prova" para quem
// quer ler a resposta completa e para o Google (FAQPage schema.org).

export const Route = createFileRoute("/perguntas-frequentes")({
  component: PerguntasFrequentesPage,
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/perguntas-frequentes",
      title: "Perguntas frequentes sobre compra, financiamento e aluguel de imóveis | imoB365",
      description:
        "Respostas claras sobre ITBI, financiamento (SAC e Price), FGTS, documentos, escritura, aluguel, garantias e venda de imóveis. Guia da imoB365.",
    }),
});

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_MERCADO.map((f) => ({
    "@type": "Question",
    name: f.pergunta,
    acceptedAnswer: { "@type": "Answer", text: f.resposta },
  })),
};

function PerguntasFrequentesPage() {
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  // Abre a pergunta indicada no #âncora (links do assistente de IA)
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && FAQ_MERCADO.some((f) => f.id === id)) {
      setAbertos(new Set([id]));
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "center" }), 50);
    }
  }, []);

  const filtrados = useMemo<FaqItem[] | null>(() => {
    if (busca.trim().length < 2) return null;
    return buscarFaq(busca, 12).map((r) => r.item);
  }, [busca]);

  const alternar = (id: string) =>
    setAbertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const Item = ({ f }: { f: FaqItem }) => {
    const aberto = abertos.has(f.id) || filtrados !== null;
    return (
      <div id={f.id} className="scroll-mt-28 rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => alternar(f.id)}
          aria-expanded={aberto}
          className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
        >
          <h3 className="font-semibold text-foreground">{f.pergunta}</h3>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
          />
        </button>
        {/* Resposta sempre no HTML (só escondida visualmente) — indexável */}
        <div className={aberto ? "px-4 pb-4" : "hidden"}>
          <p className="text-sm leading-relaxed text-muted-foreground">{f.resposta}</p>
          {f.links && f.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {f.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  {l.label} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SiteHeader />
      <div className="min-h-screen bg-background">
        <section className="bg-gradient-to-b from-primary/5 to-background px-4 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <BookOpen className="h-3.5 w-3.5" /> Guia imoB365
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">
              Perguntas frequentes sobre imóveis
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Compra, financiamento, impostos, aluguel e venda — respostas diretas, revisadas pela
              equipe imoB365. As mesmas respostas que o nosso assistente de IA usa.
            </p>
            <div className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Busque uma dúvida: ITBI, FGTS, fiador, escritura..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                aria-label="Buscar nas perguntas frequentes"
              />
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-3xl px-4 pb-16">
          {filtrados !== null ? (
            <section className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {filtrados.length
                  ? `${filtrados.length} pergunta(s) relacionada(s)`
                  : "Nenhuma pergunta encontrada — tente outras palavras ou pergunte ao assistente de IA."}
              </p>
              {filtrados.map((f) => (
                <Item key={f.id} f={f} />
              ))}
            </section>
          ) : (
            FAQ_CATEGORIAS.map((cat) => {
              const itens = FAQ_MERCADO.filter((f) => f.categoria === cat);
              if (!itens.length) return null;
              return (
                <section key={cat} className="mt-10 first:mt-2">
                  <h2 className="mb-3 flex items-center gap-2 text-xl font-bold tracking-tight">
                    <BadgeCheck className="h-5 w-5 text-primary" /> {cat}
                  </h2>
                  <div className="space-y-2.5">
                    {itens.map((f) => (
                      <Item key={f.id} f={f} />
                    ))}
                  </div>
                </section>
              );
            })
          )}

          <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-primary" />
            <h2 className="mt-2 text-lg font-bold">Não achou sua dúvida?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pergunte ao assistente de IA na página inicial ou fale com o nosso atendimento.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                to="/"
                hash="assistente-ia"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" /> Perguntar à IA
              </Link>
              <Link
                to="/atendimento"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary"
              >
                Falar com o atendimento
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">
              Conteúdo informativo e geral, baseado na legislação vigente. Regras de bancos,
              prefeituras e cartórios podem variar — confirme sempre para o seu caso.
            </p>
          </div>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
