import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { RepasseForm } from "@/components/financeiro/RepasseForm";
import { moduleGuard } from "@/lib/routeGuard";

export const Route = createFileRoute("/app/locacao/repasses/$id")({
  beforeLoad: moduleGuard("financeiro"),
  component: EditarRepasse,
});

function EditarRepasse() {
  const { id } = Route.useParams();
  return (
    <div className="p-8">
      <Link
        to="/app/locacao/repasses"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Editar repasse</h1>
      </header>
      <RepasseForm repasseId={id} />
    </div>
  );
}
