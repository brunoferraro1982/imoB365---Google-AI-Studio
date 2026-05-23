import { createFileRoute } from "@tanstack/react-router";
import { ChatModule } from "@/components/chat/ChatModule";

export const Route = createFileRoute("/app/chat/$id")({
  component: Component,
});

function Component() {
  const { id } = Route.useParams();
  return <ChatModule role="corretor" basePath="/app/chat" selectedId={id} />;
}