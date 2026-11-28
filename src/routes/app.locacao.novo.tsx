import { createFileRoute } from "@tanstack/react-router";
import { LocacaoWizard } from "@/components/locacao/LocacaoWizard";
import { actionGuard } from "@/lib/routeGuard";

export const Route = createFileRoute("/app/locacao/novo")({
  beforeLoad: actionGuard("imobiliario", "write"),
  component: NovoLocacao,
});

function NovoLocacao() {
  return <LocacaoWizard modo="novo" />;
}
