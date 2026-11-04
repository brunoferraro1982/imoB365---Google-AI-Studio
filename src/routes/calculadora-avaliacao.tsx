import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { CalculadoraAvaliacao } from "@/components/portal/CalculadoraAvaliacao";

export const Route = createFileRoute("/calculadora-avaliacao")({
  component: AvaliacaoPage,
  head: () => ({
    meta: [
      { title: "Calculadora de Valor de Imóvel — Simule quanto vale seu imóvel — imob365" },
      {
        name: "description",
        content:
          "Descubra uma estimativa de valor do seu imóvel a partir do CEP, metragem, tipo e padrão. Ferramenta gratuita de referência para compra, venda e locação.",
      },
    ],
  }),
});

export function AvaliacaoPage() {
  return (
    <div className="min-h-screen bg-muted/20">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a Home
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* LADO DA CALCULADORA (1 COLUNA) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sticky top-24">
              <CalculadoraAvaliacao />
            </div>
          </div>

          {/* CONTEÚDO EXPLICATIVO (2 COLUNAS) */}
          <div className="lg:col-span-2 space-y-8 bg-card border border-border p-6 md:p-8 rounded-2xl shadow-xs">
            <article className="prose prose-slate max-w-none space-y-6">
              <div className="space-y-2 border-b border-border pb-4">
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-850 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full">
                  <BookOpen className="h-3 w-3" /> Guia Educativo
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Como estimamos o valor do seu imóvel (e por que é só uma referência)
                </h1>
                <p className="text-xs text-muted-foreground">
                  Tempo de leitura: 4 minutos • Ferramenta gratuita • Canal do Corretor
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600 shrink-0" /> A metodologia por
                  trás do número
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A calculadora parte do <strong>valor médio do metro quadrado</strong> praticado na
                  região informada pelo CEP — cruzando dados públicos de mercado por cidade e estado
                  — e aplica ajustes conforme o <strong>tipo de imóvel</strong> (apartamento, casa,
                  terreno, comercial), o <strong>padrão</strong> (econômico até luxo) e o{" "}
                  <strong>estado de conservação</strong>. O resultado final é multiplicado pela{" "}
                  <strong>metragem privativa</strong> informada.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Para locação, aplicamos uma regra prática usada no mercado imobiliário brasileiro:
                  o aluguel mensal costuma equivaler a algo entre 0,4% e 0,6% do valor de venda do
                  imóvel.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 p-5 rounded-xl space-y-2">
                <h3 className="text-sm font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> O que este número NÃO é
                </h3>
                <p className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-400/90">
                  Esta ferramenta <strong>não substitui uma Avaliação Mercadológica (CMI)</strong>{" "}
                  feita por um corretor credenciado, nem um laudo técnico de engenharia. Ela não
                  considera fatores decisivos como vista, posição solar, ruído, documentação
                  regularizada, liquidez do bairro ou condições específicas de negociação. Trate o
                  resultado como um <strong>ponto de partida para a conversa</strong>, não como o
                  preço final de um anúncio ou de uma proposta.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary shrink-0" /> Fatores que podem mudar o
                  valor real
                </h2>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1.5">
                  <li>
                    <strong>Localização exata dentro do bairro:</strong> proximidade de praia,
                    praça, metrô ou comércio altera bastante o preço por m².
                  </li>
                  <li>
                    <strong>Estado de conservação e reformas recentes:</strong> cozinha e banheiros
                    reformados costumam agregar valor acima da média.
                  </li>
                  <li>
                    <strong>Vaga de garagem, lazer e infraestrutura do condomínio.</strong>
                  </li>
                  <li>
                    <strong>Documentação:</strong> imóveis com matrícula regularizada e sem
                    pendências valem mais e vendem mais rápido.
                  </li>
                  <li>
                    <strong>Momento de mercado:</strong> oferta e demanda da região no momento do
                    anúncio.
                  </li>
                </ul>
              </div>

              <div className="bg-primary/[0.02] border border-primary/10 p-5 rounded-xl space-y-3">
                <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Quer um número exato?
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Fale com um dos corretores parceiros da imob365 para uma Avaliação Comparativa de
                  Mercado (CMI) gratuita e personalizada, feita com base em imóveis semelhantes
                  vendidos recentemente na sua região.
                </p>
              </div>
            </article>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
