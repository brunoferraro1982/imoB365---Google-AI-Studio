import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/onboarding" || location.pathname === "/onboarding/") {
      throw redirect({ to: "/onboarding/perfil", replace: true });
    }
  },
  component: () => <Outlet />,
});
