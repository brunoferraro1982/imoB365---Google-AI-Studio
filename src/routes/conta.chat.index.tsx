import { createFileRoute, redirect } from "@tanstack/react-router";
import { ChatModule } from "@/components/chat/ChatModule";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/conta/chat/")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as any });
    }
  },
  component: () => <ChatModule role="interessado" basePath="/conta/chat" />,
});
