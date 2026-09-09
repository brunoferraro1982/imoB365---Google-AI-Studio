import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotaFiscalConfigSection } from "@/components/financeiro/NotaFiscalConfigSection";

export const Route = createFileRoute("/app/configuracoes/nota-fiscal")({
  head: () => ({ meta: [{ title: "Nota Fiscal — imob365" }] }),
  component: NotaFiscalPage,
});

function NotaFiscalPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="p-8">
      <Link
        to="/app/configuracoes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nota Fiscal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte sua própria conta Focus NFe pra emitir Nota Fiscal de Serviço (NFS-e) de verdade —
          obrigatória por lei (NFS-e Nacional, LC 214/2025) pra qualquer prestador de serviço.
        </p>
      </header>

      {isAdmin ? (
        <NotaFiscalConfigSection />
      ) : (
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem configurar a emissão de nota fiscal.
        </p>
      )}
    </div>
  );
}
