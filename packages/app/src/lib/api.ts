import type {
  CustomProviderConfig,
  ModelInfo,
  ThemeConfig,
  SkillInfo,
  SkillPaths,
  SlashCommandInfo,
} from "@friend/shared";

const API_BASE = "/api";

async function request<T>(
  path: string,
  opts?: RequestInit,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res.json();
}

// ─── Types ─────────────────────────────────────────────────────

export interface AgentInfo {
  id: string;
  name: string;
  isDefault?: boolean;
  identity?: {
    name?: string;
    emoji?: string;
    vibe?: string;
    avatar?: string;
  };
  model?: string;
  thinkingLevel?: string;
  workspace?: string;
}

export interface AgentDetail extends AgentInfo {
  resolved: {
    identity: AgentInfo["identity"];
    model?: string;
    thinkingLevel?: string;
  };
  workspaceStats: {
    exists: boolean;
    path: string;
    files: string[];
    size: number;
  };
}

export interface WorkspaceFile {
  name: string;
  path: string;
  content: string;
  size: number;
}

// ─── API ───────────────────────────────────────────────────────

export const api = {
  // Sessions
  listSessions: () => request<any[]>("/sessions"),
  createSession: (opts?: { name?: string; workingPath?: string; agentId?: string }) =>
    request<any>("/sessions", {
      method: "POST",
      body: JSON.stringify(opts),
    }),
  getSession: (id: string) => request<any>(`/sessions/${id}`),
  deleteSession: (id: string) => request<any>(`/sessions/${id}`, { method: "DELETE" }),
  renameSession: (id: string, name: string) =>
    request<void>(`/sessions/${id}/name`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  prompt: (id: string, message: string) =>
    request<void>(`/sessions/${id}/prompt`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  steer: (id: string, message: string) =>
    request<void>(`/sessions/${id}/steer`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  followUp: (id: string, message: string) =>
    request<void>(`/sessions/${id}/followUp`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  abort: (id: string) => request<void>(`/sessions/${id}/abort`, { method: "POST" }),
  compact: (id: string) => request<void>(`/sessions/${id}/compact`, { method: "POST" }),
  getStats: (id: string) => request<any>(`/sessions/${id}/stats`),
  getContextUsage: (id: string) =>
    request<{ tokens: number; contextWindow: number; percent: number } | null>(
      `/sessions/${id}/context`,
    ),
  getPendingMessages: (id: string) =>
    request<{ steering: string[]; followUp: string[] }>(`/sessions/${id}/pending`),

  // Plan mode
  planAction: (
    id: string,
    action: "execute" | "cancel" | "modify",
    options?: { todos?: any[]; message?: string },
  ) =>
    request<void>(`/sessions/${id}/plan-action`, {
      method: "POST",
      body: JSON.stringify({ action, ...options }),
    }),
  getPlanModeInfo: (id: string) =>
    request<{ enabled: boolean; executing: boolean; todos: any[] }>(`/sessions/${id}/plan`),

  // Question tool
  answerQuestion: (
    sessionId: string,
    answers: Array<{ questionId: string; answers: string[]; wasCustom?: boolean }>,
    cancelled?: boolean,
  ) =>
    request<void>(`/sessions/${sessionId}/answer-question`, {
      method: "POST",
      body: JSON.stringify({
        answers,
        cancelled: cancelled ?? false,
      }),
    }),

  // Slash commands
  getCommands: (sessionId: string) =>
    request<SlashCommandInfo[]>(`/sessions/${sessionId}/commands`),
  executeCommand: (sessionId: string, name: string, args?: string) =>
    request<void>(`/sessions/${sessionId}/command`, {
      method: "POST",
      body: JSON.stringify({ name, args }),
    }),

  // Models
  getModels: () => request<ModelInfo[]>("/models"),
  setModel: (sessionId: string, provider: string, modelId: string) =>
    request<void>(`/sessions/${sessionId}/model`, {
      method: "POST",
      body: JSON.stringify({ provider, modelId }),
    }),

  // Config
  getConfig: () => request<any>("/config"),

  // Custom providers
  getProviders: () => request<CustomProviderConfig[]>("/config/providers"),
  addProvider: (provider: CustomProviderConfig) =>
    request<void>("/config/providers", {
      method: "POST",
      body: JSON.stringify(provider),
    }),
  removeProvider: (name: string) =>
    request<void>(`/config/providers/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),

  // Themes
  getThemes: () => request<ThemeConfig[]>("/config/themes"),
  getCustomThemes: () => request<ThemeConfig[]>("/config/themes/custom"),
  addTheme: (theme: ThemeConfig) =>
    request<void>("/config/themes", {
      method: "POST",
      body: JSON.stringify(theme),
    }),
  updateTheme: (id: string, updates: Partial<ThemeConfig>) =>
    request<ThemeConfig>(`/config/themes/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
  deleteTheme: (id: string) =>
    request<void>(`/config/themes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  setActiveTheme: (themeId: string) =>
    request<void>("/config/active-theme", {
      method: "PUT",
      body: JSON.stringify({ themeId }),
    }),

  // Skills
  getSkills: (sessionId?: string) =>
    request<SkillInfo[]>(
      `/skills${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`,
    ),
  getSkillPaths: () => request<SkillPaths>("/skills/paths"),
  reloadSkills: (sessionId?: string) =>
    request<void>("/skills/reload", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),

  // ─── Embedding (Memory Search) ────────────────────────────
  getEmbeddingConfig: () =>
    request<{ provider: string; model?: string } | null>("/config/embedding"),
  setEmbeddingConfig: (config: { provider: string; model?: string }) =>
    request<void>("/config/embedding", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  // ─── Agents ────────────────────────────────────────────────
  listAgents: () => request<AgentInfo[]>("/agents"),
  getAgent: (id: string) => request<AgentDetail>(`/agents/${id}`),
  createAgent: (agent: Partial<AgentInfo> & { id?: string }) =>
    request<{ agentId: string; success: boolean }>("/agents", {
      method: "POST",
      body: JSON.stringify(agent),
    }),
  updateAgent: (id: string, updates: Partial<AgentInfo>) =>
    request<{ success: boolean }>(`/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
  deleteAgent: (id: string) =>
    request<{ success: boolean }>(`/agents/${id}`, { method: "DELETE" }),

  getAgentWorkspace: (id: string) => request<WorkspaceFile[]>(`/agents/${id}/workspace`),
  getAgentWorkspaceFile: (id: string, filename: string) =>
    request<WorkspaceFile>(`/agents/${id}/workspace/${filename}`),
  updateAgentWorkspaceFile: (id: string, filename: string, content: string) =>
    request<{ success: boolean; path: string; size: number }>(
      `/agents/${id}/workspace/${filename}`,
      {
        method: "PUT",
        body: JSON.stringify({ content }),
      },
    ),
  getAgentStats: (id: string) =>
    request<{ exists: boolean; path: string; files: string[]; size: number }>(
      `/agents/${id}/stats`,
    ),

  // ─── Subagents ──────────────────────────────────────────────
  listSubagents: (workspace?: string, scope?: "user" | "workspace" | "both") => {
    const params = new URLSearchParams();
    if (workspace) params.append("workspace", workspace);
    if (scope) params.append("scope", scope);
    const query = params.toString() ? `?${params}` : "";
    return request<{ name: string; description: string; tools?: string[]; model?: string; systemPrompt: string; source: string; filePath: string }[]>(`/subagents${query}`);
  },
  getSubagent: (name: string, workspace?: string, scope?: string) => {
    const params = new URLSearchParams();
    if (workspace) params.append("workspace", workspace);
    if (scope) params.append("scope", scope);
    const query = params.toString() ? `?${params}` : "";
    return request<{ name: string; description: string; tools?: string[]; model?: string; systemPrompt: string; source: string; filePath: string }>(`/subagents/${name}${query}`);
  },
  createSubagent: (data: {
    name: string;
    description: string;
    tools?: string[];
    model?: string;
    systemPrompt: string;
  }) =>
    request<{ name: string; description: string; tools?: string[]; model?: string; systemPrompt: string; source: string; filePath: string }>(
      "/subagents",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),
  updateSubagent: (
    name: string,
    updates: {
      description?: string;
      tools?: string[];
      model?: string;
      systemPrompt?: string;
    },
  ) =>
    request<{ name: string; description: string; tools?: string[]; model?: string; systemPrompt: string; source: string; filePath: string }>(
      `/subagents/${name}`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
      },
    ),
  deleteSubagent: (name: string) =>
    request<{ ok: boolean; message: string }>(`/subagents/${name}`, { method: "DELETE" }),
};
