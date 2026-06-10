import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Inscreve em chat_messages para uma conversa (ou todas, se sem id) e
 * invalida as queries do react-query. Mantém o badge e a thread atualizados.
 */
export function useChatRealtime(conversationId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channelName = conversationId
      ? `chat:${conversationId}-${Math.random().toString(36).substring(7)}`
      : `chat:all-${Math.random().toString(36).substring(7)}`;
    let channel = supabase.channel(channelName).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "chat_messages",
        ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {}),
      },
      () => {
        if (conversationId) {
          qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
        }
        qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
        qc.invalidateQueries({ queryKey: ["chat", "unread"] });
      },
    );
    channel = channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "chat_conversations" },
      () => {
        qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
        qc.invalidateQueries({ queryKey: ["chat", "unread"] });
      },
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);
}
