import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Calculator, Home, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader, SiteFooter } from "@/routes/index";

export const Route = createFileRoute("/calculadoras")({
  component: CalculadorasPage,
  head: () => ({
    meta: [
      { title: "Calculadoras imobiliárias — ITBI, financiamento e mudança" },
      {
        name: "description",
        content:
          "Simule ITBI, parcelas de financiamento (SAC/Price) e custo de mudança gratuitamente.",
      },
    ],
  }),
});

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function CalculadorasPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Calculadoras imobiliárias</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ferramentas gratuitas para você planejar a compra ou a mudança.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <ItbiCalc />
          <FinanciamentoCalc />
          <MudancaCalc />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({ icon: Icon, title, children }: any) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ItbiCalc() {
  const [valor, setValor] = useState(500000);
  const [aliquota, setAliquota] = useState(3);
  const total = useMemo(() => (valor * aliquota) / 100, [valor, aliquota]);
  return (
    <Card icon={Home} title="ITBI">
      <div className="space-y-3">
        <div>
          <Label>Valor do imóvel</Label>
          <Input type="number" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
        </div>
        <div>
          <Label>Alíquota (%) — varia por município</Label>
          <Input
            type="number"
            step="0.1"
            value={aliquota}
            onChange={(e) => setAliquota(Number(e.target.value))}
          />
        </div>
        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">ITBI estimado:</span>{" "}
          <span className="font-semibold">{brl(total)}</span>
        </div>
      </div>
    </Card>
  );
}

function FinanciamentoCalc() {
  const [valor, setValor] = useState(500000);
  const [entrada, setEntrada] = useState(100000);
  const [prazo, setPrazo] = useState(360);
  const [taxa, setTaxa] = useState(10.5);
  const sistema = "SAC";
  const r = useMemo(() => {
    const principal = Math.max(valor - entrada, 0);
    const i = taxa / 100 / 12;
    const n = prazo;
    if (!principal || !n) return { primeira: 0, ultima: 0, total: 0 };
    if (sistema === "SAC") {
      const amort = principal / n;
      const primeira = amort + principal * i;
      const ultima = amort + amort * i;
      const total = n * amort + (principal * i * (n + 1)) / 2;
      return { primeira, ultima, total };
    }
    return { primeira: 0, ultima: 0, total: 0 };
  }, [valor, entrada, prazo, taxa]);
  return (
    <Card icon={Calculator} title="Financiamento (SAC)">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Imóvel</Label>
            <Input type="number" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
          </div>
          <div>
            <Label>Entrada</Label>
            <Input
              type="number"
              value={entrada}
              onChange={(e) => setEntrada(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Prazo (meses)</Label>
            <Input type="number" value={prazo} onChange={(e) => setPrazo(Number(e.target.value))} />
          </div>
          <div>
            <Label>Taxa anual (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={taxa}
              onChange={(e) => setTaxa(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
          <div>
            1ª parcela: <span className="font-semibold">{brl(r.primeira)}</span>
          </div>
          <div>
            Última parcela: <span className="font-semibold">{brl(r.ultima)}</span>
          </div>
          <div>
            Total pago: <span className="font-semibold">{brl(r.total)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MudancaCalc() {
  const [m2, setM2] = useState(60);
  const [distancia, setDistancia] = useState(20);
  const [andar, setAndar] = useState(false);
  const total = useMemo(() => {
    const base = m2 * 25 + distancia * 8;
    return base * (andar ? 1.15 : 1);
  }, [m2, distancia, andar]);
  return (
    <Card icon={Wallet} title="Custo estimado de mudança">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Área do imóvel (m²)</Label>
            <Input type="number" value={m2} onChange={(e) => setM2(Number(e.target.value))} />
          </div>
          <div>
            <Label>Distância (km)</Label>
            <Input
              type="number"
              value={distancia}
              onChange={(e) => setDistancia(Number(e.target.value))}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={andar} onChange={(e) => setAndar(e.target.checked)} />{" "}
          Acima do 2º andar sem elevador
        </label>
        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">Estimativa:</span>{" "}
          <span className="font-semibold">{brl(total)}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Valor de referência. Solicite orçamento a uma transportadora parceira.
        </p>
      </div>
    </Card>
  );
}
