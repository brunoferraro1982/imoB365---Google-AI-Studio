import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ContratoForm } from "@/components/contratos/ContratoForm";

export const Route = createFileRoute("/app/contratos/novo")({
  component: NovoContrato,
});

function NovoContrato() {
  return (
    <div className="p-8">
      <Link
        to="/app/contratos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Novo contrato</h1>
      </header>
      <ContratoForm />
    </div>
  );
}
