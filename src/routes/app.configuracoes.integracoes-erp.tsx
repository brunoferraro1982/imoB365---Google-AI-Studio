import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { IntegracaoFinanceiraSection } from "@/components/financeiro/IntegracaoFinanceiraSection";

export const Route = createFileRoute("/app/configuracoes/integracoes-erp")({
  head: () => ({ meta: [{ title: "Integrações ERP — imob365" }] }),
  component: IntegracoesErpPage,
});

function IntegracoesErpPage() {
  return (
    <div className="p-8">
      <Link
        to="/app/configuracoes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Integrações ERP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre os ERPs que a imobiliária usa (Conta Azul, Omie etc.) — prepara o terreno pra
          quando a sincronização automática for construída, sem nenhuma chamada real ao ERP ainda.
        </p>
      </header>

      <IntegracaoFinanceiraSection tipo="erp" />
    </div>
  );
}
