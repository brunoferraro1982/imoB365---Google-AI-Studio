import { useMemo, useState } from "react";
import { Calculator, ChevronRight, Landmark, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

type Sistema = "price" | "sac";

interface BancoPreset {
  nome: string;
  curto: string;
  taxa: number;
  sigla: string;
  cor: string;
}

const BANCOS: BancoPreset[] = [
  { nome: "Caixa Econômica", curto: "Caixa",    taxa: 9.5,   sigla: "CEF", cor: "#0070AF" },
  { nome: "Itaú Unibanco",   curto: "Itaú",     taxa: 10.49, sigla: "ITÁ", cor: "#FF6600" },
  { nome: "Banco Bradesco",  curto: "Bradesco",  taxa: 10.9,  sigla: "BRD", cor: "#CC092F" },
  { nome: "Santander Brasil",curto: "Santander", taxa: 11.2,  sigla: "SAN", cor: "#EC0000" },
  { nome: "Banco do Brasil", curto: "BB",        taxa: 10.2,  sigla: "BB",  cor: "#F9D000" },
];

function calcular(
  valor: number,
  entrada: number,
  prazoMeses: number,
  jurosAA: number,
  sistema: Sistema,
) {
  const principal = Math.max(valor - entrada, 0);
  const i = Math.pow(1 + jurosAA / 100, 1 / 12) - 1;
  if (principal <= 0 || prazoMeses <= 0 || i <= 0) {
    return { primeira: 0, ultima: 0, total: 0, juros: 0, principal };
  }
  if (sistema === "price") {
    const pmt = (principal * i) / (1 - Math.pow(1 + i, -prazoMeses));
    const total = pmt * prazoMeses;
    return { primeira: pmt, ultima: pmt, total, juros: total - principal, principal };
  }
  // SAC
  const amort = principal / prazoMeses;
  const primeira = amort + principal * i;
  const ultima = amort + amort * i;
  const totalJuros = (i * principal * (prazoMeses + 1)) / 2;
  const total = principal + totalJuros;
  return { primeira, ultima, total, juros: totalJuros, principal };
}

export function SimuladorFinanciamento({ preco }: { preco: number }) {
  const [entrada, setEntrada] = useState(Math.round(preco * 0.2));
  const [prazo, setPrazo] = useState(360);
  const [juros, setJuros] = useState(9.5);
  const [sistema, setSistema] = useState<Sistema>("sac");
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("Caixa Econômica");
  const [loadingConsent, setLoadingConsent] = useState(false);

  const resultado = useMemo(
    () => calcular(preco, entrada, prazo, juros, sistema),
    [preco, entrada, prazo, juros, sistema],
  );

  const handleBancoPreset = (banco: BancoPreset) => {
    setBancoSelecionado(banco.nome);
    setJuros(banco.taxa);
  };

  const handleEntradaChange = (val: number) => {
    const minEntrada = Math.round(preco * 0.1);
    const maxEntrada = Math.round(preco * 0.9);
    setEntrada(Math.min(Math.max(val, minEntrada), maxEntrada));
  };

  const percentualEntrada = (entrada / preco) * 100;
  const totalFinanciado = resultado.principal;
  const totalJuros = resultado.juros;
  const totalGeral = totalFinanciado + totalJuros;

  // Calculo simplificado para SVG Donut Chart
  const strokeDash = 251.2; // 2 * pi * r (r=40)
  const percentPrincipal = totalGeral > 0 ? (totalFinanciado / totalGeral) * 100 : 50;
  const dashoffsetPrincipal = strokeDash - (strokeDash * percentPrincipal) / 100;

  const handleRequestCreditAnalysis = () => {
    setLoadingConsent(true);
    setTimeout(() => {
      setLoadingConsent(false);
      toast.success(
        "Solicitação recebida! Um especialista em crédito imobiliário entrará em contato em breve.",
      );
    }, 1200);
  };

  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Simulador de Crédito Imobiliário</h2>
            <p className="text-xs text-muted-foreground">
              Simule taxas reais com os principais bancos parceiros
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Sparkles className="h-3 w-3 animate-pulse" /> Taxas atualizadas hoje
        </div>
      </div>

      {/* Select Banco Preset */}
      <div className="mb-6">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Selecione o Banco
        </Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BANCOS.map((banco) => {
            const isSelected = bancoSelecionado === banco.nome;
            return (
              <button
                key={banco.nome}
                type="button"
                onClick={() => handleBancoPreset(banco)}
                className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-background hover:bg-muted/45"
                }`}
              >
                <span
                className="inline-flex items-center justify-center w-7 h-7 rounded font-black shrink-0 text-[9px] leading-none"
                style={{ background: banco.cor, color: banco.cor === "#F9D000" ? "#1a1a1a" : "#ffffff" }}
              >
                {banco.sigla}
              </span>
                <span className="mt-1 block text-xs font-semibold leading-tight">
                  {banco.curto}
                </span>
                <span className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                  {banco.taxa}% a.a.
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Parâmetros do Financiamento */}
        <div className="space-y-5 lg:col-span-7">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs font-medium">Valor da Entrada (BRL)</Label>
              <span className="text-xs font-bold text-primary">
                {Math.round(percentualEntrada)}%
              </span>
            </div>
            <div className="flex gap-3">
              <Input
                type="number"
                value={entrada}
                className="w-1/3 text-sm font-mono"
                onChange={(e) => handleEntradaChange(Number(e.target.value) || 0)}
              />
              <div className="flex flex-1 items-center">
                <input
                  type="range"
                  min={Math.round(preco * 0.1)}
                  max={Math.round(preco * 0.9)}
                  step={1000}
                  value={entrada}
                  onChange={(e) => handleEntradaChange(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Financiado: {formatBRL(resultado.principal)} (Requisito mín: 10% do valor)
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs font-medium font-sans">Prazo do Financiamento</Label>
                <span className="text-xs font-bold">{Math.round(prazo / 12)} anos</span>
              </div>
              <div className="flex gap-2.5">
                <Input
                  type="number"
                  value={prazo}
                  className="w-24 text-sm font-mono"
                  onChange={(e) =>
                    setPrazo(Math.min(Math.max(Number(e.target.value) || 12, 12), 420))
                  }
                />
                <div className="flex flex-1 items-center">
                  <input
                    type="range"
                    min={12}
                    max={420}
                    step={12}
                    value={prazo}
                    onChange={(e) => setPrazo(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs font-medium">Taxa de Juros Anual</Label>
                <span className="text-xs font-bold font-mono text-emerald-600">{juros}% a.a.</span>
              </div>
              <div className="flex gap-2.5">
                <Input
                  type="number"
                  step="0.05"
                  value={juros}
                  className="w-24 text-sm font-mono"
                  onChange={(e) =>
                    setJuros(Math.min(Math.max(Number(e.target.value) || 0.1, 0.1), 30))
                  }
                />
                <div className="flex flex-1 items-center">
                  <input
                    type="range"
                    min={4}
                    max={18}
                    step={0.05}
                    value={juros}
                    onChange={(e) => setJuros(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Sistema de Amortização</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setSistema("sac")}
                className={`rounded-md p-2 text-center text-xs font-medium transition-all ${
                  sistema === "sac"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/20"
                }`}
              >
                SAC{" "}
                <span className="text-[10px] block opacity-80">(Parcelas menores com o tempo)</span>
              </button>
              <button
                type="button"
                onClick={() => setSistema("price")}
                className={`rounded-md p-2 text-center text-xs font-medium transition-all ${
                  sistema === "price"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/20"
                }`}
              >
                Tabela Price{" "}
                <span className="text-[10px] block opacity-80">
                  (Parcelas fixas do início ao fim)
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Quadro de Resultados */}
        <div className="rounded-xl bg-muted/40 p-5 lg:col-span-12 xl:col-span-5 flex flex-col justify-between border border-border/60">
          <div className="space-y-4">
            <div className="text-center sm:text-left">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Valor Estimado das Parcelas
              </h4>
              <div className="mt-2 text-3xl font-black text-primary font-sans leading-none">
                {formatBRL(resultado.primeira)}
              </div>
              {sistema === "sac" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Regredindo até <span className="font-bold">{formatBRL(resultado.ultima)}</span> na
                  última parcela
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 py-3 border-t border-b border-border/50">
              {/* Gráfico Donut SVG Responsivo */}
              <div className="relative h-24 w-24 flex-shrink-0 animate-fade-in">
                <svg className="h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-chart-2 fill-none"
                    strokeWidth="12"
                  />
                  {/* Foreground Principal Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-primary fill-none transition-all duration-300"
                    strokeWidth="12"
                    strokeDasharray={strokeDash}
                    strokeDashoffset={dashoffsetPrincipal}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">
                    Financiado
                  </span>
                  <span className="text-xs font-extrabold text-primary font-mono">
                    {Math.round(percentPrincipal)}%
                  </span>
                </div>
              </div>

              {/* Legenda Resumida */}
              <div className="flex-1 space-y-2 w-full text-xs">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    <span>Crédito Principal:</span>
                  </div>
                  <span className="font-semibold font-mono">{formatBRL(totalFinanciado)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-chart-2" />
                    <span>Juros Acumulados:</span>
                  </div>
                  <span className="font-semibold font-mono">{formatBRL(totalJuros)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold pt-1 border-t border-border/40">
                  <div className="flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5 text-primary" />
                    <span>Custo Total de Quitação:</span>
                  </div>
                  <span className="font-sans text-primary">{formatBRL(totalGeral)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <button
              onClick={handleRequestCreditAnalysis}
              disabled={loadingConsent}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm hover:bg-opacity-95 transition-all text-center"
            >
              🚀 {loadingConsent ? "Aguarde..." : "Aprovar Meu Crédito Grátis"}
              <ChevronRight className="h-4 w-4" />
            </button>
            <p className="text-[10px] text-center text-muted-foreground leading-normal">
              Análise instantânea de crédito com inteligência artificial parceira de todos os bancos
              listados sem compromisso.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
