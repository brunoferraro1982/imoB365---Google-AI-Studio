import { createFileRoute } from "@tanstack/react-router";
import { Headset } from "lucide-react";
import { moduleGuard } from "@/lib/routeGuard";
import { AtendimentoSlaSection } from "@/components/atendimento/AtendimentoSlaSection";

export const Route = createFileRoute("/app/configuracoes/atendimento-sla")({
  beforeLoad: moduleGuard("atendimento"),
  component: AtendimentoSlaPage,
});

function AtendimentoSlaPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Headset className="h-6 w-6" />
        <h1 className="text-2xl font-bold tracking-tight">SLA da Central de Atendimento</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Prazos de atendimento e distribuição automática de chamados entre a sua equipe.
      </p>
      <AtendimentoSlaSection />
    </div>
  );
}
