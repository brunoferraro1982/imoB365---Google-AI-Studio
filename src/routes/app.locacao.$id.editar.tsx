import { createFileRoute } from "@tanstack/react-router";
import { LocacaoWizard } from "@/components/locacao/LocacaoWizard";
import { actionGuard } from "@/lib/routeGuard";

export const Route = createFileRoute("/app/locacao/$id/editar")({
  beforeLoad: actionGuard("imobiliario", "write"),
  component: EditarLocacao,
});

function EditarLocacao() {
  const { id } = Route.useParams();
  return <LocacaoWizard modo="editar" contratoId={id} />;
}
