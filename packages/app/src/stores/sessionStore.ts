import { create } from "zustand";
import type { SessionInfo, Message, AssistantMessage, ToolCall, ModelInfo } from "@friend/shared";
import { api } from "@/lib/api.js";

export type StreamingPhase =
  | "idle"
  | "started"
  | "thinking"
  | "generating"
  | "tool_calling"
  | "tool_executing";

interface SessionState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;
  streamingBlocks: ToolCall[];
  streamingPhase: StreamingPhase;
  activeTurnIndex: number | null;
  availableModels: ModelInfo[];
  currentModel: ModelInfo | null;

  // Actions
  setActiveTurnIndex: (index: number | null) => void;
  setSessions: (sessions: SessionInfo[]) => void;
  addSession: (session: SessionInfo) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingPhase: (phase: StreamingPhase) => void;
  appendStreamingText: (text: string) => void;
  appendStreamingThinking: (text: string) => void;
  addStreamingBlock: (block: ToolCall) => void;
  resetStreaming: () => void;
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
  streamingBlocks: [] as ToolCall[],
  streamingPhase: "idle" as StreamingPhase,
  activeTurnIndex: null,
  availableModels: [],
  currentModel: null,

  setActiveTurnIndex: (index) => set({ activeTurnIndex: index }),
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
          } else {
            const fallbackModel: ModelInfo = {
              provider,
              id: modelId,
              name: `${provider}/${modelId}`,
              available: false,
            };
            set({ currentModel: fallbackModel });
          }
        }
      }
    }
  },
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setStreamingPhase: (phase) => set({ streamingPhase: phase }),
  appendStreamingText: (text) => set((s) => ({ streamingText: s.streamingText + text })),
  appendStreamingThinking: (text) =>
    set((s) => ({ streamingThinking: s.streamingThinking + text })),
  addStreamingBlock: (block) => set((s) => ({ streamingBlocks: [...s.streamingBlocks, block] })),
  resetStreaming: () =>
    set({
      streamingText: "",
      streamingThinking: "",
      streamingBlocks: [],
    }),
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
