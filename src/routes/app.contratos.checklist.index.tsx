import { createFileRoute } from "@tanstack/react-router";
import { ModelosChecklist } from "@/components/checklist/ModelosChecklist";

export const Route = createFileRoute("/app/contratos/checklist/")({
  component: ChecklistsPage,
});

function ChecklistsPage() {
  return (
    <div className="mesh-brand-claro min-h-full">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <ModelosChecklist />
      </div>
    </div>
  );
}
