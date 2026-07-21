import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ComissaoForm } from "@/components/financeiro/ComissaoForm";

type ComissoesNovoSearch = { contrato_id?: string };

export const Route = createFileRoute("/app/comissoes/novo")({
  validateSearch: (raw: Record<string, unknown>): ComissoesNovoSearch => ({
    contrato_id: typeof raw.contrato_id === "string" ? raw.contrato_id : undefined,
  }),
  component: NovaComissao,
});

function NovaComissao() {
  const { contrato_id } = Route.useSearch();
  return (
    <div className="p-8">
      <Link
        to="/app/comissoes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nova comissão</h1>
      </header>
      <ComissaoForm contratoIdInicial={contrato_id} />
    </div>
  );
}
