import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  Home,
  MapPin,
  Ruler,
  Scale,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { CalculadoraAvaliacao } from "@/components/portal/CalculadoraAvaliacao";
import {
  BLOCO_BRANCO,
  BLOCO_CINZA,
  CARD_GLASS,
  HeroGlass,
  PaginaGlass,
  SELO,
  TITULO_SECAO,
} from "@/components/portal/PaginaGlass";
import { Fluxograma, type Etapa } from "@/components/portal/Fluxograma";

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

const FLUXO_METODO: Etapa[] = [
  { icon: MapPin, titulo: "Região", texto: "Preço do m² pelo CEP" },
  { icon: Home, titulo: "Tipo e padrão", texto: "Ajustes do imóvel" },
  { icon: Scale, titulo: "Conservação", texto: "Estado do imóvel" },
  { icon: Ruler, titulo: "Metragem", texto: "Área privativa × valor" },
];

export function AvaliacaoPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <PaginaGlass>
        <HeroGlass
          selo="Calculadora gratuita"
          seloIcon={Calculator}
          titulo="Quanto vale o seu imóvel?"
          destaque="Uma estimativa de referência."
          subtitulo="Informe o CEP, a metragem, o tipo e o padrão. O resultado é um ponto de partida para a conversa, não um laudo."
        >
          <Link
            to="/"
            className="glass-claro inline-flex items-center gap-1.5 self-center rounded-full px-4 py-2 text-xs font-bold transition hover:bg-white/60"
          >
            ← Voltar para a home
          </Link>
        </HeroGlass>

        {/* Calculadora (50%) + método (50%) */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-start gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} p-6 md:sticky md:top-24 md:p-8`}>
              <CalculadoraAvaliacao />
            </div>
            <div className="space-y-5">
              <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
                <span className={SELO}>
                  <BookOpen className="mr-1 inline h-3 w-3" /> Guia educativo
                </span>
                <h2 className={TITULO_SECAO}>Como estimamos o valor</h2>
                <p className="text-sm leading-relaxed text-foreground/80">
                  A calculadora parte do <strong>valor médio do metro quadrado</strong> praticado na
                  região do CEP e aplica ajustes conforme o <strong>tipo</strong>, o{" "}
                  <strong>padrão</strong> e a <strong>conservação</strong>. O resultado é
                  multiplicado pela <strong>metragem privativa</strong>.
                </p>
                <p className="text-sm leading-relaxed text-foreground/80">
                  Para locação, a regra prática é que o aluguel costuma ficar entre 0,4% e 0,6% do
                  valor de venda.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Fluxo do método (texto 50% + fluxograma 50%) */}
        <section className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Metodologia</span>
              <h2 className={TITULO_SECAO}>Do CEP ao valor estimado</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  Dados públicos de mercado por cidade e estado.
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Ajustes por tipo, padrão e conservação.
                </li>
              </ul>
            </div>
            <Fluxograma
              titulo="Metodologia da estimativa"
              legenda="Fluxo do cálculo"
              etapas={FLUXO_METODO}
              resultado="Estimativa de referência"
            />
          </div>
        </section>

        {/* O que NÃO é + fatores (cinza) */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-2">
            <div className="glass-fosco space-y-3 rounded-3xl border border-amber-300/60 bg-amber-50/80 p-6 md:p-8 dark:bg-amber-950/30">
              <h3 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> O que este número não é
              </h3>
              <p className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-300/90">
                Esta ferramenta <strong>não substitui uma Avaliação Mercadológica (CMI)</strong>{" "}
                feita por um corretor credenciado, nem um laudo técnico. Ela não considera vista,
                posição solar, ruído, documentação ou condições de negociação.
              </p>
            </div>
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Fatores que mudam o valor</span>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong>Localização exata:</strong> praia, praça, metrô ou comércio.
                </li>
                <li>
                  <strong>Conservação e reformas</strong> recentes.
                </li>
                <li>
                  <strong>Vaga, lazer e infraestrutura</strong> do condomínio.
                </li>
                <li>
                  <strong>Documentação</strong> regularizada e sem pendências.
                </li>
                <li>
                  <strong>Momento de mercado</strong> na região.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA (branco) */}
        <section className={BLOCO_BRANCO}>
          <div
            className={`${CARD_GLASS} mx-auto grid max-w-6xl items-center gap-4 p-6 md:grid-cols-2 md:p-8`}
          >
            <div>
              <p className="font-brand-display text-lg font-extrabold">Quer um número exato?</p>
              <p className="text-sm text-muted-foreground">
                Fale com um corretor parceiro da imob365 para uma Avaliação Comparativa de Mercado
                (CMI) gratuita, com imóveis semelhantes vendidos recentemente na sua região.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Link
                to="/contato"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
              >
                Pedir avaliação
              </Link>
            </div>
          </div>
        </section>
      </PaginaGlass>
      <SiteFooter />
    </div>
  );
}
