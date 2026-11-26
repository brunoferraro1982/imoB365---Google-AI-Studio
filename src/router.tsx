import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Navegação lenta mostra feedback em vez de manter a tela anterior congelada.
    defaultPendingMs: 300,
    defaultPendingMinMs: 200,
    defaultPendingComponent: () => (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    ),
  });

  return router;
};
