import { create } from "zustand";
import type { SessionInfo, ChatMessage, AssistantContentBlock } from "@friend/shared";

interface SessionState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;

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
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isStreaming: false,
  streamingText: "",
  streamingThinking: "",

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [...s.sessions, session] })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    })),
  setActiveSession: (id) => set({ activeSessionId: id }),
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
}));
