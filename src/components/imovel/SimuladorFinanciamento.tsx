import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/format";

type Sistema = "price" | "sac";

function calcular(valor: number, entrada: number, prazoMeses: number, jurosAA: number, sistema: Sistema) {
  const principal = Math.max(valor - entrada, 0);
  const i = Math.pow(1 + jurosAA / 100, 1 / 12) - 1;
  if (principal <= 0 || prazoMeses <= 0 || i <= 0) {
    return { primeira: 0, ultima: 0, total: 0, juros: 0 };
  }
  if (sistema === "price") {
    const pmt = (principal * i) / (1 - Math.pow(1 + i, -prazoMeses));
    const total = pmt * prazoMeses;
    return { primeira: pmt, ultima: pmt, total, juros: total - principal };
  }
  // SAC
  const amort = principal / prazoMeses;
  const primeira = amort + principal * i;
  const ultima = amort + amort * i;
  // soma juros: i * principal * (n+1)/2
  const totalJuros = (i * principal * (prazoMeses + 1)) / 2;
  const total = principal + totalJuros;
  return { primeira, ultima, total, juros: totalJuros };
}

export function SimuladorFinanciamento({ preco }: { preco: number }) {
  const [entrada, setEntrada] = useState(Math.round(preco * 0.2));
  const [prazo, setPrazo] = useState(360);
  const [juros, setJuros] = useState(10.5);
  const [sistema, setSistema] = useState<Sistema>("price");

  const resultado = useMemo(
    () => calcular(preco, entrada, prazo, juros, sistema),
    [preco, entrada, prazo, juros, sistema],
  );

  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Simulador de financiamento</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="text-xs">Valor do imóvel</Label>
          <Input type="number" value={preco} disabled />
        </div>
        <div>
          <Label className="text-xs">Entrada</Label>
          <Input
            type="number"
            value={entrada}
            min={0}
            max={preco}
            onChange={(e) => setEntrada(Math.min(Number(e.target.value) || 0, preco))}
          />
          <p className="mt-1 text-xs text-muted-foreground">{((entrada / preco) * 100).toFixed(0)}% do valor</p>
        </div>
        <div>
          <Label className="text-xs">Prazo (meses)</Label>
          <Input
            type="number"
            value={prazo}
            min={12}
            max={420}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              setPrazo(Math.min(Math.max(v, 12), 420));
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">{(prazo / 12).toFixed(0)} anos</p>
        </div>
        <div>
          <Label className="text-xs">Juros a.a. (%)</Label>
          <Input
            type="number"
            step="0.1"
            min={0.1}
            max={30}
            value={juros}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              setJuros(Math.min(Math.max(v, 0.1), 30));
            }}
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Sistema de amortização</Label>
          <div className="mt-1 inline-flex rounded-md border border-border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setSistema("price")}
              className={`rounded px-3 py-1.5 ${sistema === "price" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Price (parcela fixa)
            </button>
            <button
              type="button"
              onClick={() => setSistema("sac")}
              className={`rounded px-3 py-1.5 ${sistema === "sac" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              SAC (parcela decrescente)
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={sistema === "price" ? "Parcela mensal" : "1ª parcela"} value={formatBRL(resultado.primeira)} highlight />
        {sistema === "sac" && <Stat label="Última parcela" value={formatBRL(resultado.ultima)} />}
        <Stat label="Total de juros" value={formatBRL(resultado.juros)} />
        <Stat label="Total pago" value={formatBRL(resultado.total + entrada)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Simulação aproximada para fins informativos. Valores reais dependem do banco, perfil de crédito e taxas.
      </p>
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${highlight ? "text-xl text-primary" : "text-base"}`}>{value}</p>
    </div>
  );
}