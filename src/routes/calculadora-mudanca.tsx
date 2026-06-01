import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Calculator, ArrowLeft, BookOpen, Truck, ListChecks, Calendar, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/routes/index";

export const Route = createFileRoute("/calculadora-mudanca")({
  component: MudancaPage,
  head: () => ({
    meta: [
      { title: "Calculadora de Custo de Mudança com Dicas — imob365" },
      { name: "description", content: "Estime o custo do frete e logística para sua mudança de imóvel, acompanhe um checklist completo de organização e dicas essenciais para planejar seu novo lar." }
    ]
  }),
});

const formatBRL = (v: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

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
                <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-md font-bold text-foreground">Orçamento de Logística</h2>
                  <p className="text-3xs text-muted-foreground leading-none">Cote custos médios de frete</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mud-area" className="text-xs font-bold text-muted-foreground">Tamanho do Imóvel (m² de área útil)</Label>
                  <Input 
                    id="mud-area"
                    type="number" 
                    value={areaImovel || ""} 
                    onChange={(e) => setAreaImovel(Number(e.target.value))} 
                    className="font-semibold text-sm"
                    placeholder="Ex: 60"
                  />
                  <span className="text-[10px] text-muted-foreground leading-tight block">
                    Determina o volume total de móveis e utensílios estimados.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mud-distancia" className="text-xs font-bold text-muted-foreground">Distância de Transporte (km)</Label>
                  <Input 
                    id="mud-distancia"
                    type="number" 
                    value={distanciaKm || ""} 
                    onChange={(e) => setDistanciaKm(Number(e.target.value))} 
                    className="font-semibold text-sm"
                    placeholder="Ex: 20"
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-2.5 text-xs font-medium text-foreground cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={andarSemElevador} 
                      onChange={(e) => setAndarSemElevador(e.target.checked)} 
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="leading-tight">
                      Mudança acima do 2º andar em prédio de escadas (sem elevador)
                    </span>
                  </label>
                </div>

                <div className="border-t border-border pt-4 mt-2 space-y-3.5">
                  <div className="flex justify-between items-center bg-muted/45 p-3.5 rounded-xl border border-border/60">
                    <div className="space-y-0.5">
                      <span className="text-3xs text-muted-foreground font-bold uppercase leading-none block">Custo Estimado</span>
                      <span className="text-2xs text-muted-foreground leading-none block">Caminhão + Logística</span>
                    </div>
                    <span className="text-md font-extrabold text-[#4F46E5]">
                      {formatBRL(estimatedMovingCost)}
                    </span>
                  </div>

                  <p className="text-[10px] text-muted-foreground italic leading-normal">
                    *Este cálculo indica valores referenciais e de referência para transportadoras especializadas terrestres. Os valores reais podem mudar com necessidade de embalagens especiais, seguro de cargas ou montagem/desmontagem técnica de móveis.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CONTEÚDO DO BLOG / EXPLICAÇÃO (2 COLUNAS) */}
          <div className="lg:col-span-2 space-y-8 bg-card border border-border p-6 md:p-8 rounded-2xl shadow-xs">
            <article className="prose prose-slate max-w-none space-y-6">
              <div className="space-y-2 border-b border-border pb-4">
                <span className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-850 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full">
                  <BookOpen className="h-3 w-3 inline" /> Manual Prático
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Guia Definitivo da Mudança de Imóvel: Cronograma e Organização Descomplicada
                </h1>
                <p className="text-xs text-muted-foreground">
                  Tempo de leitura: 4 minutos • Atualizado em Maio de 2026 • Canal do Corretor
                </p>
              </div>

              {/* Seção 1 */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600 shrink-0" /> Como Funciona o Orçamento de Mudanças?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O valor de frete de uma mudança é composto pela cubagem (espaço total ocupado no baú do caminhão) e a distância geográfica percorrida. Fatores adicionais, como dificuldades de acesso físico no embarque/desembarque (ex: erguer móveis por janelas, subir múltiplos lances de escadas com armários pesados), também impactam o preço final devido ao tempo operacional e número de auxiliares extras exigidos.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Planejar os volumes, separar pertences e desapegar de itens acumulados antes da visita de vistoria da transportadora é o melhor método financeiro para encolher custos imprevistos de última hora.
                </p>
              </div>

              {/* Seção 2 */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-emerald-600 shrink-0" /> Checklist Organizacional: Cronograma 30 Dias
                </h2>
                
                <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                  <div className="border border-border p-3.5 rounded-xl space-y-1">
                    <span className="font-bold text-foreground text-xs">📅 30 dias antes: Organização e Desapego</span>
                    <p>Faça uma triagem completa em armários, gavetas e depósitos. Separe roupas, eletrodomésticos e móveis que não deseja levar e faça uma doação ou venda de usados. Quanto menos volume, mais em conta fica o transporte.</p>
                  </div>

                  <div className="border border-border p-3.5 rounded-xl space-y-1">
                    <span className="font-bold text-foreground text-xs">📦 15 dias antes: Embalagens e Transferência de Serviços</span>
                    <p>Inicie a aquisição de caixas de papelão reforçadas, fitas adesivas industriais e jornal/plástico bolha. Crie etiquetas claras identificando o conteúdo por cômodo (ex: COZINHA - PRATOS FRÁGEIS). Solicite o desligamento ou transferência de serviços essenciais como internet de fibra, luz, gás encanado e entregas recorrentes de correio.</p>
                  </div>

                  <div className="border border-border p-3.5 rounded-xl space-y-1">
                    <span className="font-bold text-foreground text-xs">🏢 7 dias antes: Alinhamento de Condomínios e Regras</span>
                    <p>Comunique formalmente as regras e horários de entrada e saída de caminhões aos síndicos e portarias de ambos os edifícios (do que está saindo e do que está entrando). Em quase todos os prédios, mudanças só são autorizadas de segunda a sexta, em horários comerciais específicos para evitar ruídos irritantes aos moradores.</p>
                  </div>
                </div>
              </div>

              {/* Dicas ao corretor */}
              <div className="bg-primary/[0.02] border border-primary/10 p-5 rounded-xl space-y-4">
                <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Dica de Préstimo de Serviço para o Corretor de Elite
                </h3>
                
                <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                  <div className="flex gap-2.5">
                    <span className="text-primary font-bold text-base shrink-0 select-none">1.</span>
                    <p>
                      <strong>Envie o Checklist de Mudança no Pos-Venda:</strong>
                      Logo no momento de assinatura do contrato de compra ou locação, presenteie o seu cliente enviando este guia interativo de custos e tarefas por WhatsApp. Esta atitude surpreende o cliente com uma experiência de cuidado (Care Quality) que vai além da burocracia comercial padrão, trazendo indicações consistentes de indicações futuras.
                    </p>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="text-primary font-bold text-base shrink-0 select-none">2.</span>
                    <p>
                      <strong>Parceria com Transportadoras Locais:</strong>
                      Faça parcerias estreitas com empresas confiáveis e bem-avaliadas de mudanças terrestres na sua cidade regional. Ofereça cupons de descontos exclusives aos seus clientes assinados e mostre-se um hub completo de resoluções de moradia.
                    </p>
                  </div>
                </div>
              </div>

              {/* Conclusão */}
              <div className="space-y-2 border-t border-border pt-4">
                <h2 className="text-md font-bold text-foreground">Iniciando a Vida Nova sem Stress</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Uma mudança planejada e estruturada transforma o que de costume é visto como um momento estressante e caótico em um processo memorável, celebrando o início de um novo ciclo com leveza e serenidade.
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
