import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A configuração deste canal foi movida para Configurações > Integrações, onde as
 * credenciais são guardadas e testadas no servidor. Esta seção não lê nem grava
 * segredos no navegador.
 */
export function AtendimentoCanalEmailSection() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold">E-mail (SMTP)</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Servidor, porta, remetente e teste de envio.
      </p>
      <Button asChild variant="outline" className="mt-4 gap-2">
        <Link to="/app/configuracoes/integracoes/email">
          Configurar em Integrações <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
