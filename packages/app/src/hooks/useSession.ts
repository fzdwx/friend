import { useCallback } from "react";
import { api } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";

export function useSession() {
  const { activeSessionId, messages, isStreaming, addMessage } = useSessionStore();

  const sendMessage = useCallback(
    async (message: string) => {
      if (!activeSessionId) return;

      // Add user message locally
      addMessage({
        role: "user",
        id: crypto.randomUUID(),
        content: message,
        timestamp: new Date().toISOString(),
      });

      await api.prompt(activeSessionId, message);
    },
    [activeSessionId, addMessage],
  );

  const steer = useCallback(
    async (message: string) => {
      if (!activeSessionId) return;
      await api.steer(activeSessionId, message);
    },
    [activeSessionId],
  );

  const abort = useCallback(async () => {
    if (!activeSessionId) return;
    await api.abort(activeSessionId);
  }, [activeSessionId]);

  return {
    sessionId: activeSessionId,
    messages,
    isStreaming,
    sendMessage,
    steer,
    abort,
  };
}
