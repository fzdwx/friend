import { create } from "zustand";
import type { SessionInfo, Message, AssistantMessage, ToolCall, ModelInfo, TodoItem, Question, SlashCommandInfo } from "@friend/shared";
import { api } from "@/lib/api.js";

export type StreamingPhase =
  | "idle"
  | "started"
  | "thinking"
  | "generating"
  | "tool_calling"
  | "tool_executing";

export interface SessionStats {
  messageCount: number;
  tokenCount: number;
  cost: number;
}

export interface ContextUsage {
  tokens: number;
  contextWindow: number;
  percent: number;
}

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
  sseConnected: boolean; // SSE connection status

  // Pending messages (steer/followUp queues)
  steeringMessages: string[];
  followUpMessages: string[];

  // Session stats and context
  sessionStats: SessionStats | null;
  contextUsage: ContextUsage | null;

  // Compaction state
  isCompacting: boolean;

  // Plan mode state
  planModeEnabled: boolean;
  planModeExecuting: boolean;
  planModeTodos: TodoItem[];
  planModeProgress: { completed: number; total: number } | null;

  // Question tool state
  pendingQuestion: {
    questionId: string;
    questions: Question[];
  } | null;

  // Slash commands
  availableCommands: SlashCommandInfo[];
  commandResult: { command: string; success: boolean; message?: string } | null;

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
  setSseConnected: (connected: boolean) => void;

  // Pending messages actions
  setSteeringMessages: (messages: string[]) => void;
  setFollowUpMessages: (messages: string[]) => void;
  addSteeringMessage: (message: string) => void;
  addFollowUpMessage: (message: string) => void;
  removeSteeringMessage: (message: string) => void;
  removeFollowUpMessage: (message: string) => void;
  clearPendingMessages: () => void;

  // Stats actions
  setSessionStats: (stats: SessionStats | null) => void;
  setContextUsage: (usage: ContextUsage | null) => void;
  refreshSessionStats: (sessionId: string) => Promise<void>;
  setCompacting: (compacting: boolean) => void;

  // Plan mode actions
  setPlanModeState: (enabled: boolean, executing: boolean, todos: TodoItem[]) => void;
  setPlanModeProgress: (completed: number, total: number) => void;
  clearPlanMode: () => void;

  // Question tool actions
  setPendingQuestion: (question: {
    questionId: string;
    questions: Question[];
  } | null) => void;
  clearPendingQuestion: () => void;

  // Slash commands actions
  loadCommands: (sessionId: string) => Promise<void>;
  setCommandResult: (result: { command: string; success: boolean; message?: string } | null) => void;
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
  sseConnected: false,
  steeringMessages: [],
  followUpMessages: [],
  sessionStats: null,
  contextUsage: null,
  isCompacting: false,
  planModeEnabled: false,
  planModeExecuting: false,
  planModeTodos: [],
  planModeProgress: null,
  pendingQuestion: null,
  availableCommands: [],
  commandResult: null,

  setActiveTurnIndex: (index) => set({ activeTurnIndex: index }),
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [...s.sessions, session] })),
  setSseConnected: (connected) => set({ sseConnected: connected }),
  removeSession: (id) =>
    set((s) => {
      const isRemovingActive = s.activeSessionId === id;
      return {
        sessions: s.sessions.filter((sess) => sess.id !== id),
        activeSessionId: isRemovingActive ? null : s.activeSessionId,
        // Reset streaming state if removing the active session
        ...(isRemovingActive && {
          isStreaming: false,
          streamingPhase: "idle",
          streamingText: "",
          streamingThinking: "",
          streamingBlocks: [],
          activeTurnIndex: null,
          steeringMessages: [],
          followUpMessages: [],
        }),
      };
    }),
  setActiveSession: (id) => {
    // Reset streaming state and messages when switching sessions
    set({
      activeSessionId: id,
      messages: [], // Clear messages when switching sessions
      isStreaming: false,
      streamingPhase: "idle",
      streamingText: "",
      streamingThinking: "",
      streamingBlocks: [],
      activeTurnIndex: null,
      steeringMessages: [],
      followUpMessages: [],
      // Reset plan mode state when switching sessions
      planModeEnabled: false,
      planModeExecuting: false,
      planModeTodos: [],
      planModeProgress: null,
    });
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

  // Pending messages actions
  setSteeringMessages: (messages) => set({ steeringMessages: messages }),
  setFollowUpMessages: (messages) => set({ followUpMessages: messages }),
  addSteeringMessage: (message) =>
    set((s) => ({ steeringMessages: [...s.steeringMessages, message] })),
  addFollowUpMessage: (message) =>
    set((s) => ({ followUpMessages: [...s.followUpMessages, message] })),
  removeSteeringMessage: (message) =>
    set((s) => ({ steeringMessages: s.steeringMessages.filter((m) => m !== message) })),
  removeFollowUpMessage: (message) =>
    set((s) => ({ followUpMessages: s.followUpMessages.filter((m) => m !== message) })),
  clearPendingMessages: () =>
    set({ steeringMessages: [], followUpMessages: [] }),

  // Stats actions
  setSessionStats: (stats) => set({ sessionStats: stats }),
  setContextUsage: (usage) => set({ contextUsage: usage }),
  refreshSessionStats: async (sessionId: string) => {
    const [statsRes, contextRes] = await Promise.all([
      api.getStats(sessionId),
      api.getContextUsage(sessionId),
    ]);
    set({
      sessionStats: statsRes.ok && statsRes.data
        ? {
            messageCount: statsRes.data.totalMessages || 0,
            tokenCount: statsRes.data.tokens?.total || 0,
            cost: statsRes.data.cost || 0,
          }
        : null,
      contextUsage: contextRes.ok && contextRes.data ? contextRes.data : null,
    });
  },
  setCompacting: (compacting) => set({ isCompacting: compacting }),

  // Plan mode actions
  setPlanModeState: (enabled, executing, todos) =>
    set({
      planModeEnabled: enabled,
      planModeExecuting: executing,
      planModeTodos: todos,
      planModeProgress: null,
    }),
  setPlanModeProgress: (completed, total) =>
    set({ planModeProgress: { completed, total } }),
  clearPlanMode: () =>
    set({
      planModeEnabled: false,
      planModeExecuting: false,
      planModeTodos: [],
      planModeProgress: null,
    }),

  // Question tool actions
  setPendingQuestion: (question) => set({ pendingQuestion: question }),
  clearPendingQuestion: () => set({ pendingQuestion: null }),

  // Slash commands actions
  loadCommands: async (sessionId: string) => {
    const res = await api.getCommands(sessionId);
    if (res.ok && res.data) {
      set({ availableCommands: res.data });
    }
  },
  setCommandResult: (result) => set({ commandResult: result }),
}));
