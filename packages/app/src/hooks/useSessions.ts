import { useCallback } from "react";
import { api } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { useToolStore } from "@/stores/toolStore";

export function useSessions() {
  const {
    sessions,
    activeSessionId,
    setSessions,
    addSession,
    removeSession,
    setActiveSession,
    setMessages,
  } = useSessionStore();
  const { clearExecutions } = useToolStore();

  const loadSessions = useCallback(async () => {
    const res = await api.listSessions();
    if (res.ok && res.data) {
      setSessions(res.data);
    }
  }, [setSessions]);

  const createSession = useCallback(
    async (opts?: { name?: string; workingPath?: string }) => {
      const res = await api.createSession(opts);
      if (res.ok && res.data) {
        addSession(res.data);
        setActiveSession(res.data.id);
        setMessages([]);
        clearExecutions();
        return { data: res.data };
      }
      return { error: res.error || "Failed to create session" };
    },
    [addSession, setActiveSession, setMessages, clearExecutions],
  );

  const switchSession = useCallback(
    async (id: string) => {
      setActiveSession(id);
      clearExecutions();
      const res = await api.getSession(id);
      if (res.ok && res.data) {
        setMessages(res.data.messages || []);
      }
    },
    [setActiveSession, setMessages, clearExecutions],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      const res = await api.deleteSession(id);
      if (res.ok) {
        removeSession(id);
        if (activeSessionId === id) {
          setMessages([]);
          clearExecutions();
        }
      }
    },
    [removeSession, activeSessionId, setMessages, clearExecutions],
  );

  return {
    sessions,
    activeSessionId,
    loadSessions,
    createSession,
    switchSession,
    deleteSession,
  };
}
