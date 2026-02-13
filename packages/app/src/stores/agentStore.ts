import { create } from "zustand";
import { api, type AgentInfo } from "@/lib/api";

// Re-export types for convenience
export type { AgentInfo } from "@/lib/api";

interface AgentState {
  agents: AgentInfo[];
  activeAgentId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadAgents: () => Promise<void>;
  createAgent: (agent: Partial<AgentInfo> & { id?: string }) => Promise<{ error?: string; data?: AgentInfo }>;
  updateAgent: (id: string, updates: Partial<AgentInfo>) => Promise<{ error?: string }>;
  deleteAgent: (id: string) => Promise<{ error?: string }>;
  setActiveAgent: (id: string | null) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  activeAgentId: null,
  loading: false,
  error: null,

  loadAgents: async () => {
    set({ loading: true, error: null });
    const res = await api.listAgents();
    if (res.ok && res.data) {
      set({ agents: res.data, loading: false });
    } else {
      set({ error: res.error || "Failed to load agents", loading: false });
    }
  },

  createAgent: async (agent) => {
    const res = await api.createAgent(agent);
    if (res.ok && res.data) {
      await get().loadAgents();
      const newAgent = get().agents.find(a => a.id === res.data!.agentId);
      return { data: newAgent };
    }
    return { error: res.error || "Failed to create agent" };
  },

  updateAgent: async (id, updates) => {
    const res = await api.updateAgent(id, updates);
    if (res.ok) {
      await get().loadAgents();
      return {};
    }
    return { error: res.error || "Failed to update agent" };
  },

  deleteAgent: async (id) => {
    const res = await api.deleteAgent(id);
    if (res.ok) {
      await get().loadAgents();
      return {};
    }
    return { error: res.error || "Failed to delete agent" };
  },

  setActiveAgent: (id) => set({ activeAgentId: id }),
}));
