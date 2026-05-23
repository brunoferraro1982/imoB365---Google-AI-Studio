import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LancamentoForm } from "@/components/financeiro/LancamentoForm";

export const Route = createFileRoute("/app/financeiro/$id")({
  component: EditarLancamento,
});

function EditarLancamento() {
  const { id } = Route.useParams();
  return (
    <div className="p-8">
      <Link to="/app/financeiro" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Editar lançamento</h1>
      </header>
      <LancamentoForm lancamentoId={id} />
    </div>
  );
}