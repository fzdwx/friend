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
      // Restore active session after sessions are loaded
      const savedSessionId = useSessionStore.getState().activeSessionId;
      if (savedSessionId && res.data.some(s => s.id === savedSessionId)) {
        // Fetch session details (including isStreaming state)
        const sessionRes = await api.getSession(savedSessionId);
        if (sessionRes.ok && sessionRes.data) {
          setMessages(sessionRes.data.messages || []);
          // Restore streaming state if session is still streaming
          if (sessionRes.data.isStreaming) {
            useSessionStore.getState().setStreaming(true);
            useSessionStore.getState().setStreamingPhase("started");
          }
          // Restore plan mode state if exists
          if (sessionRes.data.planModeState) {
            setPlanModeState(
              sessionRes.data.planModeState.enabled,
              sessionRes.data.planModeState.executing,
              sessionRes.data.planModeState.todos,
              sessionRes.data.planModeState.modifying,
            );
          }
          // Restore pending question if exists
          if (sessionRes.data.pendingQuestion) {
            useSessionStore.getState().setPendingQuestion(sessionRes.data.pendingQuestion);
          }
        }
      }
    }
  }, [setSessions, setMessages, setPlanModeState]);

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
        // Restore streaming state if session is still streaming
        if (res.data.isStreaming) {
          useSessionStore.getState().setStreaming(true);
          useSessionStore.getState().setStreamingPhase("started");
        }
        // Restore plan mode state if exists
        if (res.data.planModeState) {
          setPlanModeState(
            res.data.planModeState.enabled,
            res.data.planModeState.executing,
            res.data.planModeState.todos,
            res.data.planModeState.modifying,
          );
        } else {
          setPlanModeState(false, false, [], false);
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
