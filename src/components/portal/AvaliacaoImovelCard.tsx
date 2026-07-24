import { Home, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function AvaliacaoImovelCard() {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-emerald-200/70 bg-card p-6 dark:border-emerald-900/40 md:p-8">
      <div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <Home className="h-6 w-6" />
        </div>
        <span className="mt-4 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400">
          Novo
        </span>
        <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
          Quanto vale o seu imóvel?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe CEP, metragem, tipo e padrão do imóvel e receba, em segundos, uma estimativa de
          valor de venda ou aluguel com base em médias de mercado da sua região.
        </p>
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
          Valor de referência, sujeito a variação — não substitui uma avaliação feita por um
          corretor credenciado.
        </p>
      </div>
      <Link to="/calculadora-avaliacao" className="mt-6 block">
        <Button size="lg" className="w-full gap-2">
          Calcular agora <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
