import { createFileRoute } from "@tanstack/react-router";
import { ChatModule } from "@/components/chat/ChatModule";

export const Route = createFileRoute("/app/chat/")({
  component: () => <ChatModule role="corretor" basePath="/app/chat" />,
});