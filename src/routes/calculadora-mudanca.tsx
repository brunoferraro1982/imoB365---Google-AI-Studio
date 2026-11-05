import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Calculator,
  CalendarCheck,
  Package,
  Sparkles,
  Truck,
  Building2,
  Ruler,
  Route as RotaIcon,
  Trash2,
  Tag,
  Zap,
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

export const Route = createFileRoute("/calculadora-mudanca")({
  component: MudancaPage,
  head: async () =>
    seoHead({
      seo: await getSeoConfig(),
      path: "/calculadora-mudanca",
      title: "Calculadora de Custo de Mudança com Dicas — imob365",
      description:
        "Estime o custo do frete e logística para sua mudança de imóvel, acompanhe um checklist completo de organização e dicas essenciais para planejar seu novo lar.",
    }),
});

const formatBRL = (v: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

const FLUXO_CRONOGRAMA: Etapa[] = [
  { icon: Trash2, titulo: "30 dias antes", texto: "Triagem e desapego" },
  { icon: Package, titulo: "15 dias antes", texto: "Caixas e serviços" },
  { icon: Building2, titulo: "7 dias antes", texto: "Síndico e portaria" },
  { icon: CalendarCheck, titulo: "Dia da mudança", texto: "Caminhão e equipe" },
];

const FLUXO_ORCAMENTO: Etapa[] = [
  { icon: Ruler, titulo: "Cubagem", texto: "Área e volume de móveis" },
  { icon: RotaIcon, titulo: "Distância", texto: "Km percorridos" },
  { icon: Zap, titulo: "Acesso", texto: "Escada e sem elevador" },
  { icon: Truck, titulo: "Estimativa", texto: "Caminhão e logística" },
];

export function MudancaPage() {
  const [areaImovel, setAreaImovel] = useState<number>(60);
  const [distanciaKm, setDistanciaKm] = useState<number>(20);
  const [andarSemElevador, setAndarSemElevador] = useState<boolean>(false);

  const estimatedMovingCost = useMemo(() => {
    if (!areaImovel || !distanciaKm) return 0;
    // Base cost formula: area (m2) * R$25 per m2 + distance (km) * R$8 per km
    const baseVal = areaImovel * 25 + distanciaKm * 8;
    // 15% increase if carrying via stairs up to second floors
    return baseVal * (andarSemElevador ? 1.15 : 1);
  }, [areaImovel, distanciaKm, andarSemElevador]);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <PaginaGlass>
        <HeroGlass
          selo="Calculadora gratuita"
          seloIcon={Calculator}
          titulo="Custo de mudança"
          destaque="sem surpresas no dia do frete."
          subtitulo="Estime o frete e a logística da sua mudança, com um checklist de organização para os 30 dias antes."
        >
          <Link
            to="/"
            className="glass-claro inline-flex items-center gap-1.5 self-center rounded-full px-4 py-2 text-xs font-bold transition hover:bg-white/60"
          >
            ← Voltar para a home
          </Link>
        </HeroGlass>

        {/* Orçamento (50%) + explicação (50%) */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-start gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} p-6 md:sticky md:top-24 md:p-8`}>
              <div className="mb-5 flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Orçamento de logística</h2>
                  <p className="text-[11px] text-muted-foreground">Cote custos médios de frete</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mud-area" className="text-xs font-bold text-muted-foreground">
                    Tamanho do imóvel (m² de área útil)
                  </Label>
                  <Input
                    id="mud-area"
                    type="number"
                    value={areaImovel || ""}
                    onChange={(e) => setAreaImovel(Number(e.target.value))}
                    className="bg-white/80 text-sm font-semibold dark:bg-white/5"
                    placeholder="Ex: 60"
                  />
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    Determina o volume total de móveis e utensílios estimados.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="mud-distancia"
                    className="text-xs font-bold text-muted-foreground"
                  >
                    Distância de transporte (km)
                  </Label>
                  <Input
                    id="mud-distancia"
                    type="number"
                    value={distanciaKm || ""}
                    onChange={(e) => setDistanciaKm(Number(e.target.value))}
                    className="bg-white/80 text-sm font-semibold dark:bg-white/5"
                    placeholder="Ex: 20"
                  />
                </div>

                <div className="pt-1">
                  <label className="flex cursor-pointer select-none items-start gap-2.5 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={andarSemElevador}
                      onChange={(e) => setAndarSemElevador(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="leading-tight">
                      Mudança acima do 2º andar em prédio de escadas (sem elevador)
                    </span>
                  </label>
                </div>

                <div className="mt-2 space-y-3 border-t border-black/5 pt-4 dark:border-white/10">
                  <div className="flex items-center justify-between rounded-2xl bg-white/70 p-3.5 dark:bg-white/5">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                        Custo estimado
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Caminhão + logística
                      </span>
                    </div>
                    <span className="text-base font-extrabold text-[#4F46E5]">
                      {formatBRL(estimatedMovingCost)}
                    </span>
                  </div>
                  <p className="text-[11px] italic leading-normal text-muted-foreground">
                    *Valores referenciais para transportadoras terrestres. Podem mudar com
                    embalagens especiais, seguro de cargas ou montagem e desmontagem técnica de
                    móveis.
                  </p>
                </div>
              </div>
            </div>

            <div className={`${CARD_GLASS} space-y-4 p-6 md:p-8`}>
              <span className={SELO}>Como funciona o orçamento</span>
              <h2 className={TITULO_SECAO}>Frete = volume + distância + acesso</h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                O frete é composto pela <strong>cubagem</strong> (espaço ocupado no baú do caminhão)
                e pela <strong>distância percorrida</strong>. Dificuldades de acesso, como subir
                escadas com armários pesados, também elevam o preço pelo tempo e pelos auxiliares
                extras.
              </p>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Tag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Desapegar antes da vistoria da transportadora é a forma mais simples de reduzir o
                custo.
              </p>
            </div>
          </div>
        </section>

        {/* Fluxo do orçamento (texto 50% + fluxograma 50%) */}
        <section className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Orçamento</span>
              <h2 className={TITULO_SECAO}>Do volume ao custo estimado</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                A calculadora usa a área do imóvel, a distância e o acesso ao prédio para chegar ao
                valor referencial da mudança.
              </p>
            </div>
            <Fluxograma
              titulo="Orçamento da mudança"
              legenda="Fluxo do orçamento"
              etapas={FLUXO_ORCAMENTO}
              resultado="Custo referencial para pedir orçamento"
            />
          </div>
        </section>

        {/* Cronograma de 30 dias (cinza) */}
        <section className={BLOCO_CINZA}>
          <div className="mx-auto grid max-w-6xl items-center gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Cronograma de 30 dias</span>
              <h2 className={TITULO_SECAO}>Organização, embalagens e condomínio</h2>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <strong>30 dias antes:</strong> faça a triagem de armários, gavetas e depósitos.
                  Doe ou venda o que não vai levar.
                </li>
                <li>
                  <strong>15 dias antes:</strong> compre caixas reforçadas, etiquete por cômodo e
                  transfira internet, luz e gás.
                </li>
                <li>
                  <strong>7 dias antes:</strong> avise o síndico e a portaria dos dois prédios sobre
                  o caminhão. Em geral, mudanças são autorizadas só em dias úteis, em horário
                  comercial.
                </li>
              </ul>
            </div>
            <Fluxograma
              titulo="Cronograma da mudança"
              legenda="Fluxo do cronograma"
              etapas={FLUXO_CRONOGRAMA}
              resultado="Mudança sem imprevistos"
            />
          </div>
        </section>

        {/* Dicas para o corretor (branco) */}
        <section className={BLOCO_BRANCO}>
          <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-2">
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>
                <Sparkles className="mr-1 inline h-3 w-3" /> Para o corretor
              </span>
              <h2 className={TITULO_SECAO}>Encante o cliente no pós-venda</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Logo após a assinatura do contrato, envie este guia de custos e tarefas pelo
                WhatsApp. É um gesto de cuidado que vai além da burocracia e gera indicações.
              </p>
            </div>
            <div className={`${CARD_GLASS} space-y-3 p-6 md:p-8`}>
              <span className={SELO}>Parcerias</span>
              <h2 className={TITULO_SECAO}>Transportadoras de confiança</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Tenha parceiros locais bem avaliados e ofereça descontos exclusivos aos seus
                clientes. Assim você vira o ponto de referência completo para a moradia nova.
              </p>
            </div>
          </div>
        </section>

        {/* Conclusão (cinza) */}
        <section className={BLOCO_CINZA}>
          <div className={`${CARD_GLASS} mx-auto max-w-6xl p-6 text-center md:p-8`}>
            <p className="font-brand-display text-lg font-extrabold">
              Começando a vida nova sem stress
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              Uma mudança planejada transforma um momento caótico em um processo leve, que celebra o
              início de um novo ciclo.
            </p>
          </div>
        </section>
      </PaginaGlass>
      <SiteFooter />
    </div>
  );
}
