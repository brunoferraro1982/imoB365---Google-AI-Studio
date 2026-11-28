import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ContratoForm } from "@/components/contratos/ContratoForm";

export const Route = createFileRoute("/app/contratos/novo")({
  validateSearch: (search: Record<string, unknown>): { tipo?: string } => ({
    tipo: typeof search.tipo === "string" ? search.tipo : undefined,
  }),
  // Locações são cadastradas no módulo de Locação (/app/locacao/novo).
  beforeLoad: ({ search }) => {
    if (search.tipo === "locacao") {
      throw redirect({ to: "/app/locacao/novo" });
    }
  },
  component: NovoContrato,
});

function NovoContrato() {
  return (
    <div className="mesh-brand-claro min-h-full p-4 md:p-8">
      <Link
        to="/app/contratos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="glass-fosco rounded-3xl border border-white/40 p-6 md:p-8 mb-6">
        <h1 className="font-brand-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Novo contrato
        </h1>
      </header>
      <ContratoForm />
    </div>
  );
}
