import { useCallback } from "react";
import { api } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import type { UserMessage } from "@friend/shared";

export function useSession() {
  // Use selectors for proper subscription
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const messages = useSessionStore((s) => s.messages);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const addMessage = useSessionStore((s) => s.addMessage);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!activeSessionId) return;

      // Add user message locally (optimistic)
      const userMsg: UserMessage = {
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      addMessage(userMsg);

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
