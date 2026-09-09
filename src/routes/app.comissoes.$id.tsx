import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ComissaoForm } from "@/components/financeiro/ComissaoForm";
import { NotaFiscalComissaoSection } from "@/components/financeiro/NotaFiscalComissaoSection";

export const Route = createFileRoute("/app/comissoes/$id")({
  component: EditarComissao,
});

function EditarComissao() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-6 p-8">
      <Link
        to="/app/comissoes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Editar comissão</h1>
      </header>
      <ComissaoForm comissaoId={id} />
      <NotaFiscalComissaoSection comissaoId={id} />
    </div>
  );
}
