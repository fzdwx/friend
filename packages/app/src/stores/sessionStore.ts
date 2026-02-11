import { create } from "zustand";
import type { SessionInfo, ChatMessage, AssistantContentBlock, ModelInfo } from "@friend/shared";
import { api } from "@/lib/api.js";

interface SessionState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;
  availableModels: ModelInfo[];
  currentModel: ModelInfo | null;

  // Actions
  setSessions: (sessions: SessionInfo[]) => void;
  addSession: (session: SessionInfo) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamingText: (text: string) => void;
  appendStreamingThinking: (text: string) => void;
  resetStreaming: () => void;
  finalizeAssistantMessage: (id: string, blocks: AssistantContentBlock[]) => void;
  loadModels: () => Promise<void>;
  setCurrentModel: (sessionId: string, provider: string, modelId: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isStreaming: false,
  streamingText: "",
  streamingThinking: "",
  availableModels: [],
  currentModel: null,

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [...s.sessions, session] })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    })),
  setActiveSession: (id) => {
    set({ activeSessionId: id });
    if (id) {
      const session = get().sessions.find((s) => s.id === id);
      if (session?.model) {
        const [provider, modelId] = session.model.split("/");
        if (provider && modelId) {
          const model = get().availableModels.find(
            (m) => m.provider === provider && m.id === modelId,
          );
          if (model) {
            set({ currentModel: model });
          }
        }
      }
    }
  },
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  appendStreamingText: (text) => set((s) => ({ streamingText: s.streamingText + text })),
  appendStreamingThinking: (text) =>
    set((s) => ({ streamingThinking: s.streamingThinking + text })),
  resetStreaming: () => set({ streamingText: "", streamingThinking: "" }),
  finalizeAssistantMessage: (id, blocks) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          role: "assistant" as const,
          id,
          content: blocks,
          timestamp: new Date().toISOString(),
        },
      ],
    })),
  loadModels: async () => {
    const res = await api.getModels();
    if (res.ok && res.data) {
      set({ availableModels: res.data });
    }
  },
  setCurrentModel: async (sessionId: string, provider: string, modelId: string) => {
    const res = await api.setModel(sessionId, provider, modelId);
    if (res.ok) {
      const model = get().availableModels.find((m) => m.provider === provider && m.id === modelId);
      if (model) {
        set({ currentModel: model });
      }
    }
  },
}));
