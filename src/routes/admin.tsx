import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/admin")({
  component: () => <AppShell variant="admin" />,
});