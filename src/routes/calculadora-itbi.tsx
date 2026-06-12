import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Calculator, ArrowLeft, BookOpen, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/calculadora-itbi")({
  component: ItbiPage,
  head: () => ({
    meta: [
      { title: "Calculadora de ITBI Completa com Dicas — imob365" },
      {
        name: "description",
        content:
          "Calcule o Imposto sobre Transmissão de Bens Imóveis (ITBI), entenda como funciona e confira dicas práticas para corretores e imobiliárias.",
      },
    ],
  }),
});

const formatBRL = (v: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

export function ItbiPage() {
  const [valor, setValor] = useState<number>(500000);
  const [aliquota, setAliquota] = useState<number>(3);

  const totalITBI = useMemo(() => {
    if (!valor || !aliquota) return 0;
    return (valor * aliquota) / 100;
  }, [valor, aliquota]);

  // Outros custos estimados de cartório (Escritura + Registro geralmente +/- 1.5% do valor do imóvel)
  const custosCartorioEst = useMemo(() => {
    if (!valor) return 0;
    return valor * 0.015;
  }, [valor]);

  const custoTotalCartorario = useMemo(() => {
    return totalITBI + custosCartorioEst;
  }, [totalITBI, custosCartorioEst]);

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
                <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-600">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-md font-bold text-foreground">Calculadora de ITBI</h2>
                  <p className="text-3xs text-muted-foreground leading-none">
                    Simule de forma simples e rápida
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="itbi-valor" className="text-xs font-bold text-muted-foreground">
                    Valor de Venda do Imóvel
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="itbi-valor"
                      type="number"
                      value={valor || ""}
                      onChange={(e) => setValor(Number(e.target.value))}
                      className="pl-9 font-semibold text-sm"
                      placeholder="Ex: 500000"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="itbi-aliquota"
                    className="text-xs font-bold text-muted-foreground"
                  >
                    Alíquota do ITBI (%)
                  </Label>
                  <Input
                    id="itbi-aliquota"
                    type="number"
                    step="0.1"
                    value={aliquota || ""}
                    onChange={(e) => setAliquota(Number(e.target.value))}
                    className="font-semibold text-sm"
                    placeholder="Varia entre 2% e 4% de acordo com o município"
                  />
                  <span className="text-[10px] text-muted-foreground block leading-tight">
                    *Geralmente varia de 2% a 3% na maioria das cidades.
                  </span>
                </div>

                <div className="border-t border-border pt-4 mt-2 space-y-3.5">
                  <div className="flex justify-between items-center bg-muted/45 p-3 rounded-xl border border-border/60">
                    <div className="space-y-0.5">
                      <span className="text-3xs text-muted-foreground font-bold uppercase leading-none block">
                        ITBI Estimado
                      </span>
                      <span className="text-2xs text-muted-foreground leading-none block">
                        Imposto municipal
                      </span>
                    </div>
                    <span className="text-md font-extrabold text-orange-600">
                      {formatBRL(totalITBI)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-xl border border-dashed border-border/80 text-3xs">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-bold uppercase block">
                        Escritura e Registro Est.
                      </span>
                      <span className="text-muted-foreground block">Média de 1.5% do imóvel</span>
                    </div>
                    <span className="font-semibold text-foreground">
                      {formatBRL(custosCartorioEst)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-primary/[0.03] p-3.5 rounded-xl border border-primary/10">
                    <div className="space-y-0.5">
                      <span className="text-3xs text-primary font-bold uppercase leading-none block">
                        Investimento Operacional
                      </span>
                      <span className="text-3xs text-muted-foreground leading-none block">
                        Imposto + Certidões
                      </span>
                    </div>
                    <span className="text-base font-black text-primary">
                      {formatBRL(custoTotalCartorario)}
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
                <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-850 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full">
                  <BookOpen className="h-3 w-3" /> Guia Educativo
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Tudo sobre ITBI: O que é, quem paga e como orientar o seu cliente
                </h1>
                <p className="text-xs text-muted-foreground">
                  Tempo de leitura: 4 minutos • Atualizado em Maio de 2026 • Canal do Corretor
                </p>
              </div>

              {/* Seção 1 */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> O que é o ITBI?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O <strong>ITBI</strong> significa{" "}
                  <em>Imposto sobre a Transmissão de Bens Imóveis</em>. Trata-se de um imposto de
                  competência municipal, o que significa que cada cidade possui autonomia para
                  definir sua própria alíquota, formas de cobrança e regras de isenção.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sem o pagamento desse imposto, o cartório de registro de imóveis não faz a
                  transferência da escritura de compra e venda. Na prática,{" "}
                  <strong>
                    quem compra o imóvel não se torna o dono legal perante a lei enquanto o ITBI não
                    estiver quitado
                  </strong>{" "}
                  e o registro finalizado.
                </p>
              </div>

              {/* Seção 2 */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary shrink-0" /> Quem é o responsável pelo
                  pagamento?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Legalmente, o Código Tributário Nacional prevê que a responsabilidade do imposto
                  pode ser regulamentada pelas leis municipais. No entanto, por praxe do mercado
                  imobiliário brasileiro e pelas legislações de quase 100% dos municípios,{" "}
                  <strong>o pagamento do ITBI cabe exclusivamente ao comprador do imóvel</strong>.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Existem acordos comerciais particulares onde o vendedor assume este custo como
                  margem de negociação empresarial, mas a guia de pagamento é emitida sempre
                  nominalmente ao novo adquirente.
                </p>
              </div>

              {/* Seção 3 - Dicas ao Corretor */}
              <div className="bg-primary/[0.02] border border-primary/10 p-5 rounded-xl space-y-4">
                <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Dicas de Ouro para o Corretor de Imóveis
                </h3>

                <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                  <div className="flex gap-2.5">
                    <span className="text-primary font-bold text-base shrink-0 select-none">
                      1.
                    </span>
                    <p>
                      <strong>
                        Nunca deixe um fechamento de contrato sem avisar sobre as custas de
                        transferência:
                      </strong>
                      Muitos clientes de primeira viagem consomem todas as economias pensando
                      unicamente no valor da entrada do financiamento. Sempre avise com antecedência
                      que o cliente precisará guardar cerca de{" "}
                      <strong>4% a 5% do valor do imóvel</strong> para arcar com o ITBI e
                      emolumentos de cartório (escritura e registro).
                    </p>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="text-primary font-bold text-base shrink-0 select-none">
                      2.
                    </span>
                    <p>
                      <strong>Fique atento às regras de Isenção ou Desconto:</strong>
                      Muitos municípios dão descontos generosos em caso de compra do{" "}
                      <strong>primeiro imóvel</strong> financiado pelo SFH (Sistema Financeiro de
                      Habitação) ou através de programas habitacionais, como o Minha Casa Minha
                      Vida. Pesquise e use essa informação na negociação para demonstrar domínio
                      técnico e proteger o bolso do cliente!
                    </p>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="text-primary font-bold text-base shrink-0 select-none">
                      3.
                    </span>
                    <p>
                      <strong>Dica de Financiamento Embutido:</strong>A maioria dos grandes bancos
                      (como Caixa, Itaú, Bradesco) permite que o cliente inclua as despesas de ITBI
                      e Registro no próprio contrato de financiamento imobiliário (limitado por leis
                      de margem de garantia). Essa é uma excelente saída para clientes que fecharam
                      no limite da reserva de capital.
                    </p>
                  </div>
                </div>
              </div>

              {/* Seção 4 */}
              <div className="space-y-2 border-t border-border pt-4">
                <h2 className="text-md font-bold text-foreground">Como o imposto é calculado?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O valor do imposto é uma multiplicação simples da alíquota da sua cidade sobre o{" "}
                  <strong>Valor de Base do Imóvel</strong>. Esse valor de base geralmente é o maior
                  entre duas grandezas:
                </p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1.5 mt-2">
                  <li>
                    <strong>Valor Venal de Referência:</strong> Valor estipulado pela prefeitura
                    para recolhimento de tributos baseado no cadastro do IPTU.
                  </li>
                  <li>
                    <strong>Valor Real de Transação:</strong> O valor negociado de venda entre
                    comprador e vendedor que consta no contrato assinado.
                  </li>
                </ul>
              </div>
            </article>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
