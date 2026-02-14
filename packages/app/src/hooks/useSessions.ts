import { useCallback } from "react";
import { api } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { useToolStore } from "@/stores/toolStore";
import { getT } from "@/i18n/useTranslation";

export function useSessions() {
  const {
    sessions,
    activeSessionId,
    setSessions,
    addSession,
    removeSession,
    setActiveSession,
    setMessages,
    setPlanModeState,
  } = useSessionStore();
  const { clearExecutions } = useToolStore();

  const loadSessions = useCallback(async () => {
    const res = await api.listSessions();
    if (res.ok && res.data) {
      setSessions(res.data);
    }
  }, [setSessions]);

  const createSession = useCallback(
    async (opts?: { name?: string; workingPath?: string; agentId?: string }) => {
      const res = await api.createSession(opts);
      if (res.ok && res.data) {
        addSession(res.data);
        setActiveSession(res.data.id);
        setMessages([]);
        clearExecutions();
        return { data: res.data };
      }
      return { error: res.error || getT()("errors.failedCreateSession") };
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
        // Restore plan mode state if exists
        if (res.data.planModeState) {
          setPlanModeState(
            res.data.planModeState.enabled,
            res.data.planModeState.executing,
            res.data.planModeState.todos,
          );
        } else {
          setPlanModeState(false, false, []);
        }
        // Restore pending question if exists
        if (res.data.pendingQuestion) {
          useSessionStore.getState().setPendingQuestion(res.data.pendingQuestion);
        } else {
          useSessionStore.getState().clearPendingQuestion();
        }
      }
    },
    [setActiveSession, setMessages, clearExecutions, setPlanModeState],
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

  const renameSession = useCallback(
    async (id: string, name: string) => {
      const res = await api.renameSession(id, name);
      if (res.ok) {
        // Update the session name in the store
        const updatedSessions = sessions.map((s) => (s.id === id ? { ...s, name } : s));
        setSessions(updatedSessions);
        return { data: { id, name } };
      }
      return { error: res.error || getT()("errors.failedRenameSession") };
    },
    [setSessions, sessions],
  );

  return {
    sessions,
    activeSessionId,
    loadSessions,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
  };
}
