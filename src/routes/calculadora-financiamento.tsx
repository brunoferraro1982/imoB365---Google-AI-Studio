import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Calculator,
  CalendarDays,
  Coins,
  Gauge,
  Landmark,
  Percent,
  PiggyBank,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { seoHead, getSeoConfig } from "@/lib/seo";
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

export const Route = createFileRoute("/calculadora-financiamento")({
  component: FinanciamentoPage,
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/calculadora-financiamento",
      title: "Calculadora de Financiamento SAC com Dicas — imob365",
      description:
        "Simule as parcelas de financiamento pelo sistema SAC, entenda como funciona a amortização e confira dicas financeiras essenciais para o mercado imobiliário.",
    }),
});

const formatBRL = (v: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

const FLUXO_SAC: Etapa[] = [
  { icon: Landmark, titulo: "Financiado", texto: "Valor menos a entrada" },
  { icon: Coins, titulo: "Amortização fixa", texto: "Principal ÷ prazo" },
  { icon: Percent, titulo: "Juros decrescentes", texto: "Sobre o saldo devedor" },
  { icon: TrendingDown, titulo: "Parcela cai", texto: "Todo mês, até quitar" },
];

const FLUXO_APROVACAO: Etapa[] = [
  { icon: PiggyBank, titulo: "Entrada", texto: "Quanto o cliente tem" },
  { icon: Gauge, titulo: "Renda", texto: "Parcela até 30% da renda" },
  { icon: Wallet, titulo: "FGTS", texto: "Amortiza a cada 2 anos" },
  { icon: ShieldCheck, titulo: "Aprovação", texto: "Sem atrito no banco" },
];

export function FinanciamentoPage() {
  const [valorImovel, setValorImovel] = useState<number>(500000);
  const [entrada, setEntrada] = useState<number>(100000);
  const [prazoMeses, setPrazoMeses] = useState<number>(360);
  const [taxaAnual, setTaxaAnual] = useState<number>(10.5);

  const financiamentoResult = useMemo(() => {
    const principal = Math.max(valorImovel - entrada, 0);
    const n = prazoMeses;
    const taxaMensal = taxaAnual / 100 / 12;

    if (!principal || !n || !taxaAnual) {
      return {
        primeiraParcela: 0,
        ultimaParcela: 0,
        totalPago: 0,
        totalJuros: 0,
        amortizacaoConstante: 0,
      };
    }

    // SAC (Sistema de Amortização Constante)
    const amortizacaoConstante = principal / n;

    // Primeira parcela = Amortização + Juros sobre o saldo devedor inicial
    const jurosPrimeira = principal * taxaMensal;
    const primeiraParcela = amortizacaoConstante + jurosPrimeira;

    // Última parcela = Amortização + Juros sobre o último saldo devedor (que é igual a amortização)
    const jurosUltima = amortizacaoConstante * taxaMensal;
    const ultimaParcela = amortizacaoConstante + jurosUltima;

    // Somatório da PA simples dos juros acumulados ou fórmula matemática direta
    // Juros total = (S0 + Sn) * n / 2 * taxa_mensal
    const totalJuros = (((principal + amortizacaoConstante) * n) / 2) * taxaMensal;
    const totalPago = principal + totalJuros;

    return {
      primeiraParcela,
      ultimaParcela,
      totalPago,
      totalJuros,
      amortizacaoConstante,
    };
  }, [valorImovel, entrada, prazoMeses, taxaAnual]);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <PaginaGlass>
        <HeroGlass
          selo="Simulador gratuito"
          seloIcon={Calculator}
          titulo="Financiamento SAC"
          destaque="a parcela que cai todo mês."
          subtitulo="Simule a primeira e a última parcela, o total de juros e a amortização fixa do sistema SAC."
        >
          <Link
            to="/"
            className="glass-claro inline-flex items-center gap-1.5 self-center rounded-full px-4 py-2 text-xs font-bold transition hover:bg-white/60"
          >
            ← Voltar para a home
          </Link>
        </HeroGlass>

        {/* Simulador (50%) + explicação (50%) */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-start gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} p-6 md:sticky md:top-24 md:p-8`}>
              <div className="mb-5 flex items-center gap-2.5">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Simulador SAC</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Cálculo de amortização constante
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fin-valor" className="text-xs font-bold text-muted-foreground">
                    Valor do imóvel
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="fin-valor"
                      type="number"
                      value={valorImovel || ""}
                      onChange={(e) => setValorImovel(Number(e.target.value))}
                      className="bg-white/80 pl-9 text-sm font-semibold dark:bg-white/5"
                      placeholder="Ex: 500000"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fin-entrada" className="text-xs font-bold text-muted-foreground">
                    Valor da entrada (sinal)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="fin-entrada"
                      type="number"
                      value={entrada || ""}
                      onChange={(e) => setEntrada(Number(e.target.value))}
                      className="bg-white/80 pl-9 text-sm font-semibold dark:bg-white/5"
                      placeholder="Ex: 100000"
                    />
                  </div>
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    Financiado: {formatBRL(Math.max(valorImovel - entrada, 0))}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fin-prazo" className="text-xs font-bold text-muted-foreground">
                      Prazo (meses)
                    </Label>
                    <Input
                      id="fin-prazo"
                      type="number"
                      value={prazoMeses || ""}
                      onChange={(e) => setPrazoMeses(Number(e.target.value))}
                      className="bg-white/80 text-sm font-semibold dark:bg-white/5"
                      placeholder="Ex: 360"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fin-taxa" className="text-xs font-bold text-muted-foreground">
                      Taxa anual (%)
                    </Label>
                    <Input
                      id="fin-taxa"
                      type="number"
                      step="0.1"
                      value={taxaAnual || ""}
                      onChange={(e) => setTaxaAnual(Number(e.target.value))}
                      className="bg-white/80 text-sm font-semibold dark:bg-white/5"
                      placeholder="Ex: 10.5"
                    />
                  </div>
                </div>

                <div className="mt-2 space-y-3 border-t border-black/5 pt-4 dark:border-white/10">
                  <div className="flex items-center justify-between rounded-2xl bg-white/70 p-3.5 dark:bg-white/5">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                        Primeira parcela
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Fase mais alta
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-foreground">
                      {formatBRL(financiamentoResult.primeiraParcela)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3.5">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-emerald-700">
                        Última parcela
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Fase mais baixa
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-600">
                      {formatBRL(financiamentoResult.ultimaParcela)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-dashed border-black/10 p-3.5 dark:border-white/15">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                        Amortização fixa / mês
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Desconto da dívida
                      </span>
                    </div>
                    <span className="font-semibold text-foreground">
                      {formatBRL(financiamentoResult.amortizacaoConstante)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/[0.05] p-3.5">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-primary">
                        Valor total acumulado
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Principal + {formatBRL(financiamentoResult.totalJuros)} de juros
                      </span>
                    </div>
                    <span className="text-sm font-black text-primary">
                      {formatBRL(financiamentoResult.totalPago)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
                <span className={SELO}>Análise financeira</span>
                <h2 className={TITULO_SECAO}>O que é o SAC</h2>
                <p className="text-sm leading-relaxed text-foreground/80">
                  O <strong>SAC</strong> é o financiamento mais contratado no Brasil. A amortização
                  (a parte da dívida que você abate) é <strong>igual do início ao fim</strong>.
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Os juros incidem sobre o saldo devedor, que cai a cada mês. Por isso a parcela
                  começa no maior valor e diminui até a quitação.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Fluxo do cálculo SAC (texto 50% + fluxograma 50%) */}
        <section className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Como a parcela é calculada</span>
              <h2 className={TITULO_SECAO}>Amortização fixa, juros que encolhem</h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                A cada mês, a parcela soma a amortização fixa com os juros sobre o saldo que ainda
                resta. Como o saldo diminui, os juros também diminuem.
              </p>
            </div>
            <Fluxograma
              titulo="Cálculo da parcela SAC"
              legenda="Fluxo do SAC"
              etapas={FLUXO_SAC}
              resultado="Parcelas decrescentes até a quitação"
            />
          </div>
        </section>

        {/* SAC vs Price (cinza) */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Tabela SAC</span>
              <h2 className={TITULO_SECAO}>Parcelas decrescentes</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Parcelas de pagamento decrescentes.</li>
                <li>Amortização constante desde o início.</li>
                <li>Custo total de juros menor no final.</li>
                <li>Primeira prestação cerca de 20% a 30% mais cara que na Price.</li>
              </ul>
            </div>
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Tabela Price</span>
              <h2 className={TITULO_SECAO}>Parcelas fixas e lineares</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Todas as prestações são fixas.</li>
                <li>Amortização começa pequena e acelera no final.</li>
                <li>Custo total de juros maior no final.</li>
                <li>Costuma ser aprovada com mais facilidade por manter a renda equilibrada.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Dicas (branco) */}
        <section className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Dicas para corretores e imobiliárias</span>
              <h2 className={TITULO_SECAO}>Prepare o cliente para o banco</h2>
              <div className="space-y-3 text-sm leading-relaxed text-foreground/80">
                <p>
                  <strong>1. Use o SAC para tranquilizar.</strong> Mostre que a parcela é uma
                  ladeira descendente. Nas primeiras 60 parcelas ela já fica bem mais leve.
                </p>
                <p>
                  <strong>2. Amortização extraordinária com FGTS.</strong> Usar o saldo do FGTS a
                  cada 2 anos reduz o prazo de 30 para menos de 12 anos e corta os juros pela
                  metade.
                </p>
                <p>
                  <strong>3. A regra dos 30%.</strong> A maior barreira de crédito é a parcela
                  passar de 30% da renda bruta comprovada. Ajuste a entrada na simulação para
                  encontrar o valor que aprova sem atrito.
                </p>
              </div>
            </div>
            <Fluxograma
              titulo="Checklist de aprovação"
              legenda="Fluxo de aprovação"
              etapas={FLUXO_APROVACAO}
              resultado="Financiamento aprovado sem atrito"
            />
          </div>
        </section>

        {/* Conclusão (cinza) */}
        <section className={BLOCO_CINZA}>
          <div className={`${CARD_GLASS} mx-auto max-w-6xl p-6 md:p-8`}>
            <p className="font-brand-display text-lg font-extrabold">
              A importância do planejamento prévio
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Financiar um lar é uma das decisões financeiras mais importantes para uma família. Ter
              números precisos, entender que as taxas variam de instituição para instituição e usar
              simuladores confiáveis cria uma relação justa entre a imobiliária e o comprador.
            </p>
          </div>
        </section>
      </PaginaGlass>
      <SiteFooter />
    </div>
  );
}
