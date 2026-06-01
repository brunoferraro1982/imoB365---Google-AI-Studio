import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Calculator, ArrowLeft, BookOpen, Percent, Landmark, HelpCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/routes/index";

export const Route = createFileRoute("/calculadora-financiamento")({
  component: FinanciamentoPage,
  head: () => ({
    meta: [
      { title: "Calculadora de Financiamento SAC com Dicas — imob365" },
      { name: "description", content: "Simule as parcelas de financiamento pelo sistema SAC, entenda como funciona a amortização e confira dicas financeiras essenciais para o mercado imobiliário." }
    ]
  }),
});

const formatBRL = (v: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

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
      return { primeiraParcela: 0, ultimaParcela: 0, totalPago: 0, totalJuros: 0, amortizacaoConstante: 0 };
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
    const totalJuros = ((principal + amortizacaoConstante) * n / 2) * taxaMensal;
    const totalPago = principal + totalJuros;

    return {
      primeiraParcela,
      ultimaParcela,
      totalPago,
      totalJuros,
      amortizacaoConstante
    };
  }, [valorImovel, entrada, prazoMeses, taxaAnual]);

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
              <div className="mb-5 flex items-center gap-2.5">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-md font-bold text-foreground">Simulador SAC</h2>
                  <p className="text-3xs text-muted-foreground leading-none">Cálculo de Amortização Constante</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fin-valor" className="text-xs font-bold text-muted-foreground">Valor do Imóvel</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                    <Input 
                      id="fin-valor"
                      type="number" 
                      value={valorImovel || ""} 
                      onChange={(e) => setValorImovel(Number(e.target.value))} 
                      className="pl-9 font-semibold text-sm"
                      placeholder="Ex: 500000"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fin-entrada" className="text-xs font-bold text-muted-foreground">Valor da Entrada (Sinal)</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                    <Input 
                      id="fin-entrada"
                      type="number" 
                      value={entrada || ""} 
                      onChange={(e) => setEntrada(Number(e.target.value))} 
                      className="pl-9 font-semibold text-sm"
                      placeholder="Ex: 100000"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-tight block">
                    Financiado: {formatBRL(Math.max(valorImovel - entrada, 0))}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fin-prazo" className="text-xs font-bold text-muted-foreground">Prazo (Meses)</Label>
                    <Input 
                      id="fin-prazo"
                      type="number" 
                      value={prazoMeses || ""} 
                      onChange={(e) => setPrazoMeses(Number(e.target.value))} 
                      className="font-semibold text-sm"
                      placeholder="Ex: 360"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fin-taxa" className="text-xs font-bold text-muted-foreground">Taxa Anual (%)</Label>
                    <Input 
                      id="fin-taxa"
                      type="number" 
                      step="0.1" 
                      value={taxaAnual || ""} 
                      onChange={(e) => setTaxaAnual(Number(e.target.value))} 
                      className="font-semibold text-sm"
                      placeholder="Ex: 10.5"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2 space-y-3">
                  <div className="flex justify-between items-center bg-muted/45 p-3 rounded-xl border border-border/60">
                    <div className="space-y-0.5">
                      <span className="text-3xs text-muted-foreground font-bold uppercase leading-none block">Primeira Parcela</span>
                      <span className="text-[10px] text-muted-foreground leading-none block">Fase mais alta</span>
                    </div>
                    <span className="text-sm font-extrabold text-foreground">
                      {formatBRL(financiamentoResult.primeiraParcela)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-emerald-500/[0.02] p-3 rounded-xl border border-emerald-500/10">
                    <div className="space-y-0.5">
                      <span className="text-3xs text-emerald-700 font-bold uppercase leading-none block">Última Parcela</span>
                      <span className="text-[10px] text-muted-foreground leading-none block">Fase mais baixa</span>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-600">
                      {formatBRL(financiamentoResult.ultimaParcela)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-xl border border-dashed border-border/80 text-3xs">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-bold uppercase block">Amortização Fixa / Mês</span>
                      <span className="text-muted-foreground block">Desconto da dívida</span>
                    </div>
                    <span className="font-semibold text-foreground">
                      {formatBRL(financiamentoResult.amortizacaoConstante)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-primary/[0.03] p-3.5 rounded-xl border border-primary/10">
                    <div className="space-y-0.5">
                      <span className="text-3xs text-primary font-bold uppercase leading-none block">Valor Total Acumulado</span>
                      <span className="text-3xs text-muted-foreground leading-none block">Principal + {formatBRL(financiamentoResult.totalJuros)} juros</span>
                    </div>
                    <span className="text-sm font-black text-primary">
                      {formatBRL(financiamentoResult.totalPago)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CONTEÚDO DO BLOG / EXPLICAÇÃO (2 COLUNAS) */}
          <div className="lg:col-span-2 space-y-8 bg-card border border-border p-6 md:p-8 rounded-2xl shadow-xs">
            <article className="prose prose-slate max-w-none space-y-6">
              <div className="space-y-2 border-b border-border pb-4">
                <span className="inline-flex items-center gap-1.5 bg-sky-150 text-indigo-850 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full">
                  <BookOpen className="h-3 w-3 inline" /> Análise Financeira
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Tudo sobre Financiamento SAC: O Sistema que faz a sua parcela cair todo mês
                </h1>
                <p className="text-xs text-muted-foreground">
                  Tempo de leitura: 5 minutos • Atualizado em Maio de 2026 • Canal do Corretor
                </p>
              </div>

              {/* Seção 1 */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary shrink-0" /> O que é o Sistema de Amortização Constante (SAC)?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O <strong>SAC</strong> é a modalidade de financiamento imobiliário mais contratada no Brasil. Sua grande vantagem reside no seu modelo de cálculo: <strong>o valor deduzido da dívida principal (a amortização) permanece rigorosamente idêntico do início ao fim do prazo</strong>.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Dado que os juros mensais incidem apenas sobre o saldo devedor restante (e esse saldo devedor decola para baixo em parcelas fixas reais a cada mês), os juros devidos encolhem sequencialmente. Por este motivo, as prestações mensais do sistema SAC são decrescentes — começam no valor máximo e reduzem gradativamente até a quitação final.
                </p>
              </div>

              {/* Seção 2 */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Percent className="h-5 w-5 text-emerald-600 shrink-0" /> SAC vs. Tabela Price: Qual é a diferença?
                </h2>
                <div className="grid gap-4 md:grid-cols-2 text-xs leading-relaxed mt-2">
                  <div className="p-4 rounded-xl border border-border bg-muted/15">
                    <h4 className="font-bold text-foreground mb-1.5 flex items-center gap-1.5">🛡️ Tabela SAC</h4>
                    <ul className="space-y-1 list-disc pl-4 text-muted-foreground">
                      <li>Parcelas de pagamento decrescentes.</li>
                      <li>Amortização constante desde o início.</li>
                      <li>Custo total de juros acumulados no final é menor.</li>
                      <li>Primeira prestação é cerca de 20% a 30% mais cara que na Price.</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 rounded-xl border border-border bg-muted/15">
                    <h4 className="font-bold text-foreground mb-1.5 flex items-center gap-1.5">⚖️ Tabela Price</h4>
                    <ul className="space-y-1 list-disc pl-4 text-muted-foreground">
                      <li>Todas as prestações são fixas e lineares.</li>
                      <li>Amortização começa pequena e acelera no final.</li>
                      <li>Custo total de juros acumulados no final é maior.</li>
                      <li>Aprovado mais facilmente por manter equilíbrio na renda.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Dicas ao corretor */}
              <div className="bg-primary/[0.02] border border-primary/10 p-5 rounded-xl space-y-4">
                <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4" /> Dicas Comerciais para Corretores & Imobiliárias
                </h3>
                
                <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                  <div className="flex gap-2.5">
                    <span className="text-primary font-bold text-base shrink-0 select-none">1.</span>
                    <p>
                      <strong>Use o SAC para contornar temores com oscilação econômica:</strong>
                      Se o seu comprador teme perder renda ou comprometer-se por períodos longos de 30 anos, demonstre analiticamente que no SAC a prestação é uma ladeira descendente. Já nas primeiras 60 parcelas, as prestações ficam bastante leves, reduzindo em muito a exposição do orçamento doméstico.
                    </p>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="text-primary font-bold text-base shrink-0 select-none">2.</span>
                    <p>
                      <strong>Explique a Amortização Extraordianária (FGTS):</strong>
                      Instrua o cliente a poupar e utilizar o saldo do FGTS a cada 2 anos para amortizar saldo devedor. Isso faz com que contratos originalmente previstos para 30 anos (360 meses) possam ser finalizados com segurança em menos de 10 ou 12 anos, reduzindo os juros finais à metade.
                    </p>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="text-primary font-bold text-base shrink-0 select-none">3.</span>
                    <p>
                      <strong>A Regra dos 30% de Comprometimento:</strong>
                      A maior barreira de recusa de crédito bancária é exceder 30% da renda comprovada bruta familiar na parcela inicial. Ajude o comprador a balancear a entrada no formulário de simulação acima para encontrar o montante exato necessário para garantir uma aprovação rápida e sem atritos técnicos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Seção de Conclusão */}
              <div className="space-y-2 border-t border-border pt-4">
                <h2 className="text-md font-bold text-foreground">A Importância do Planejamento Prévio</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Financiar um lar é uma das decisões financeiras mais memoráveis da vida de uma família brasileira. Ter contato com números precisos, entender que as taxas de juros no mercado de habitação variam de instituição para instituição e usar simuladores confiáveis ajuda a construir autoridade comercial e criar uma relação justa e tranquila entre a imobiliária e o comprador.
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
