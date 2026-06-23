import { Link } from "@tanstack/react-router";
import { AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

interface Props {
  status: "suspended" | "cancelled";
}

export function SuspendedModal({ status }: Props) {
  const isCancelled = status === "cancelled";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg text-center">
        <Logo className="h-8 w-auto mx-auto mb-6" />

        <div
          className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            isCancelled
              ? "bg-muted text-muted-foreground border border-border"
              : "bg-red-500/10 border border-red-500/20 text-red-500"
          }`}
        >
          {isCancelled ? (
            <XCircle className="h-6 w-6 stroke-[2.25]" />
          ) : (
            <AlertTriangle className="h-6 w-6 stroke-[2.25]" />
          )}
        </div>

        <h1 className="text-xl font-bold tracking-tight">
          {isCancelled ? "Conta cancelada" : "Conta suspensa"}
        </h1>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {isCancelled
            ? "Sua conta foi cancelada. Seus dados ficam disponíveis por 30 dias. Para reativar, entre em contato com o suporte."
            : "Sua conta foi suspensa por falta de pagamento ou por ação administrativa. Regularize sua situação para retomar o acesso."}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link to="/planos">
            <Button className="w-full" variant={isCancelled ? "outline" : "default"}>
              {isCancelled ? "Ver planos" : "Regularizar assinatura"}
            </Button>
          </Link>
          <a href="mailto:suporte@imob365.com.br">
            <Button className="w-full" variant="ghost">
              Falar com o suporte
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
