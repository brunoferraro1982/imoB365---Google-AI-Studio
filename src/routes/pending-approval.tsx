import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Mail, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/pending-approval")({
  component: PendingApproval,
});

function PendingApproval() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-tight">Aguardando aprovação</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sua solicitação de acesso foi recebida com sucesso. Nossa equipe irá
            analisar os seus dados e você receberá uma notificação por e-mail.
          </p>
        </div>

        {/* Info pill */}
        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs text-muted-foreground">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span>Verifique sua caixa de entrada</span>
        </div>

        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline mt-2"
        >
          <ArrowLeft className="h-3 w-3" />
          Voltar ao portal
        </Link>
      </div>
    </div>
  );
}
