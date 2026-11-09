import { createFileRoute } from "@tanstack/react-router";
import { ChecklistWizard } from "@/components/checklist/ChecklistWizard";
import { moduleGuard } from "@/lib/routeGuard";

export const Route = createFileRoute("/app/contratos/checklist/novo")({
  beforeLoad: moduleGuard("juridico"),
  component: NovoChecklistPage,
});

function NovoChecklistPage() {
  return (
    <div className="mesh-brand-claro min-h-full">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <ChecklistWizard />
      </div>
    </div>
  );
}
