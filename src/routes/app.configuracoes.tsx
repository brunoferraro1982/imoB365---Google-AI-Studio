import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/configuracoes")({
  component: ConfiguracoesLayout,
});

function ConfiguracoesLayout() {
  return (
    <div className="p-8">
      <main className="bg-white dark:bg-card border border-border/70 rounded-2xl p-6.5 shadow-sm min-h-[500px]">
        <Outlet />
      </main>
    </div>
  );
}
