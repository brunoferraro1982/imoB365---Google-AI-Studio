import { createFileRoute, Outlet } from "@tanstack/react-router";
import { moduleGuard } from "@/lib/routeGuard";

// Layout das telas de checklist (lista em "/" e wizard em "/novo").
export const Route = createFileRoute("/app/contratos/checklist")({
  beforeLoad: moduleGuard("juridico"),
  component: () => <Outlet />,
});
