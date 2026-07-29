import { createFileRoute } from "@tanstack/react-router";
import { Headset } from "lucide-react";
import { moduleGuard } from "@/lib/routeGuard";
import { AtendimentoCanalEmailSection } from "@/components/atendimento/AtendimentoCanalEmailSection";

export const Route = createFileRoute("/app/configuracoes/atendimento-canais")({
  beforeLoad: moduleGuard("atendimento"),
  component: AtendimentoCanaisPage,
});

function AtendimentoCanaisPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Headset className="h-6 w-6" />
        <h1 className="text-2xl font-bold tracking-tight">Canais da Central de Atendimento</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Conecte suas próprias contas de e-mail e WhatsApp — cada imobiliária usa as próprias
        credenciais, nunca uma conta compartilhada da imoB365.
      </p>
      <AtendimentoCanalEmailSection />
    </div>
  );
}
