import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Calculator,
  CheckCircle2,
  ClipboardList,
  FileText,
  Landmark,
  Percent,
  Scale,
  Stamp,
  Wallet,
  AlertCircle,
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

export const Route = createFileRoute("/calculadora-itbi")({
  component: ItbiPage,
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/calculadora-itbi",
      title: "Calculadora de ITBI Completa com Dicas — imob365",
      description:
        "Calcule o Imposto sobre Transmissão de Bens Imóveis (ITBI), entenda como funciona e confira dicas práticas para corretores e imobiliárias.",
    }),
});

const formatBRL = (v: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

const FLUXO_CALCULO: Etapa[] = [
  { icon: Scale, titulo: "Valor de base", texto: "O maior entre venal e real" },
  { icon: Percent, titulo: "Alíquota", texto: "Definida pela cidade" },
  { icon: Landmark, titulo: "ITBI", texto: "Pago pelo comprador" },
  { icon: Stamp, titulo: "Escritura e registro", texto: "Cartório, ~1,5%" },
];

const FLUXO_DICAS: Etapa[] = [
  { icon: Wallet, titulo: "Reserve", texto: "4% a 5% do imóvel" },
  { icon: ClipboardList, titulo: "Confira isenções", texto: "Primeiro imóvel, SFH" },
  { icon: FileText, titulo: "Inclua no financiamento", texto: "Quando o banco permitir" },
  { icon: CheckCircle2, titulo: "Avise antes", texto: "Antes do fechamento" },
];

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
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <PaginaGlass>
        <HeroGlass
          selo="Calculadora gratuita"
          seloIcon={Calculator}
          titulo="Calculadora de ITBI"
          destaque="com tudo o que você precisa saber."
          subtitulo="Simule o imposto de transmissão e os custos de cartório. O ITBI é municipal: confira a alíquota da sua cidade."
        >
          <Link
            to="/"
            className="glass-claro inline-flex items-center gap-1.5 self-center rounded-full px-4 py-2 text-xs font-bold transition hover:bg-white/60"
          >
            ← Voltar para a home
          </Link>
        </HeroGlass>

        {/* Calculadora (50%) + dicas (50%) */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-start gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} p-6 md:sticky md:top-24 md:p-8`}>
              <div className="mb-5 flex items-center gap-2.5">
                <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-600">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Simule seu ITBI</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Simule de forma simples e rápida
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="itbi-valor" className="text-xs font-bold text-muted-foreground">
                    Valor de venda do imóvel
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
                      className="bg-white/80 pl-9 text-sm font-semibold dark:bg-white/5"
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
                    className="bg-white/80 text-sm font-semibold dark:bg-white/5"
                    placeholder="Varia entre 2% e 4% de acordo com o município"
                  />
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    *Geralmente varia de 2% a 3% na maioria das cidades.
                  </span>
                </div>

                <div className="mt-2 space-y-3 border-t border-black/5 pt-4 dark:border-white/10">
                  <div className="flex items-center justify-between rounded-2xl bg-white/70 p-3.5 dark:bg-white/5">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                        ITBI estimado
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Imposto municipal
                      </span>
                    </div>
                    <span className="text-base font-extrabold text-orange-600">
                      {formatBRL(totalITBI)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-dashed border-black/10 p-3.5 dark:border-white/15">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                        Escritura e registro est.
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Média de 1,5% do imóvel
                      </span>
                    </div>
                    <span className="font-semibold text-foreground">
                      {formatBRL(custosCartorioEst)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/[0.05] p-3.5">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-primary">
                        Investimento operacional
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Imposto + certidões
                      </span>
                    </div>
                    <span className="text-base font-black text-primary">
                      {formatBRL(custoTotalCartorario)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${CARD_GLASS} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Dicas de ouro para o corretor</span>
              <h2 className={TITULO_SECAO}>Proteja o bolso do cliente</h2>
              <div className="space-y-3 text-sm leading-relaxed text-foreground/80">
                <p>
                  <strong>1. Avise sobre as custas de transferência.</strong> Muitos clientes de
                  primeira viagem guardam só a entrada do financiamento. Peça que reserve cerca de{" "}
                  <strong>4% a 5% do valor do imóvel</strong> para ITBI e emolumentos de cartório.
                </p>
                <p>
                  <strong>2. Confira isenções e descontos.</strong> Muitos municípios reduzem o ITBI
                  na compra do primeiro imóvel financiado pelo SFH ou por programas habitacionais.
                </p>
                <p>
                  <strong>3. Financiamento embutido.</strong> Grandes bancos costumam permitir
                  incluir ITBI e registro no contrato, dentro dos limites de margem de garantia.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Fluxo do cálculo (texto 50% + fluxograma 50%) */}
        <section className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Como é calculado</span>
              <h2 className={TITULO_SECAO}>O imposto é uma multiplicação simples</h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                O valor do ITBI é a alíquota da sua cidade sobre o{" "}
                <strong>valor de base do imóvel</strong>, que é o maior entre estas duas grandezas:
              </p>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong>Valor venal de referência:</strong> definido pela prefeitura, com base no
                  cadastro do IPTU.
                </li>
                <li>
                  <strong>Valor real de transação:</strong> o valor negociado, que consta no
                  contrato assinado.
                </li>
              </ul>
            </div>
            <Fluxograma
              titulo="Cálculo do ITBI"
              legenda="Fluxo do cálculo"
              etapas={FLUXO_CALCULO}
              resultado="Custo de transferência estimado"
            />
          </div>
        </section>

        {/* O que é + quem paga (cinza) */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Entenda o imposto</span>
              <h2 className={TITULO_SECAO}>O que é o ITBI?</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong>ITBI</strong> é o <em>Imposto sobre a Transmissão de Bens Imóveis</em>, de
                competência municipal: cada cidade define a alíquota, a cobrança e as isenções.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Sem o pagamento, o cartório não registra a escritura. Por isso,{" "}
                <strong>
                  o comprador só se torna dono perante a lei após quitar o ITBI e registrar
                </strong>
                .
              </p>
            </div>
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Quem paga</span>
              <h2 className={TITULO_SECAO}>Na prática, o comprador</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Pela praxe do mercado e pelas legislações de quase todos os municípios,{" "}
                <strong>o ITBI cabe ao comprador</strong>. A guia é emitida sempre no nome do novo
                adquirente.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Vendedor e comprador podem combinar que o vendedor arque com o custo, como margem de
                negociação.
              </p>
            </div>
          </div>
        </section>

        {/* Fluxo das dicas (texto 50% + fluxograma 50%) */}
        <section className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Antes do fechamento</span>
              <h2 className={TITULO_SECAO}>Checklist de custos para o cliente</h2>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Esse fluxo resume as dicas da seção anterior, na ordem em que vale conversar com o
                cliente.
              </p>
            </div>
            <Fluxograma
              titulo="Checklist de custos"
              legenda="Fluxo de orientação"
              etapas={FLUXO_DICAS}
              resultado="Cliente preparado para o fechamento"
            />
          </div>
        </section>
      </PaginaGlass>
      <SiteFooter />
    </div>
  );
}
