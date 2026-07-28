import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AssinaturaConfigSection } from "@/components/contratos/AssinaturaConfigSection";

export const Route = createFileRoute("/app/configuracoes/assinatura-eletronica")({
  head: () => ({ meta: [{ title: "Assinatura eletrônica — imob365" }] }),
  component: AssinaturaEletronicaPage,
});

function AssinaturaEletronicaPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Assinatura eletrônica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte a conta própria da imobiliária em um provedor de assinatura eletrônica — usada no
          painel de assinatura de cada contrato.
        </p>
      </header>

      {isAdmin ? (
        <AssinaturaConfigSection />
      ) : (
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem configurar a integração de assinatura eletrônica.
        </p>
      )}
    </div>
  );
}
