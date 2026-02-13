import { useCallback } from "react";
import { api } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";

export function useSession() {
  // Use selectors for proper subscription
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const messages = useSessionStore((s) => s.messages);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const setSteeringMessages = useSessionStore((s) => s.setSteeringMessages);
  const setFollowUpMessages = useSessionStore((s) => s.setFollowUpMessages);

  // Fetch pending messages from backend (source of truth)
  const refreshPendingMessages = useCallback(async () => {
    if (!activeSessionId) return;
    const res = await api.getPendingMessages(activeSessionId);
    if (res.ok && res.data) {
      setSteeringMessages(res.data.steering);
      setFollowUpMessages(res.data.followUp);
    }
  }, [activeSessionId, setSteeringMessages, setFollowUpMessages]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!activeSessionId) return;
      await api.prompt(activeSessionId, message);
    },
    [activeSessionId],
  );

  const steer = useCallback(
    async (message: string) => {
      if (!activeSessionId) return;
      await api.steer(activeSessionId, message);
      // Refresh pending messages from backend
      await refreshPendingMessages();
    },
    [activeSessionId, refreshPendingMessages],
  );

  const followUp = useCallback(
    async (message: string) => {
      if (!activeSessionId) return;
      await api.followUp(activeSessionId, message);
      // Refresh pending messages from backend
      await refreshPendingMessages();
    },
    [activeSessionId, refreshPendingMessages],
  );

  const abort = useCallback(async () => {
    if (!activeSessionId) return;
    await api.abort(activeSessionId);
    // Clear pending messages locally (backend will clear on abort)
    setSteeringMessages([]);
    setFollowUpMessages([]);
  }, [activeSessionId, setSteeringMessages, setFollowUpMessages]);

  return {
    sessionId: activeSessionId,
    messages,
    isStreaming,
    sendMessage,
    steer,
    followUp,
    abort,
    refreshPendingMessages,
  };
}
