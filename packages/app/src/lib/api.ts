import type { CustomProviderConfig, ModelInfo, ThemeConfig, SkillInfo, SkillPaths } from "@friend/shared";

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

export const api = {
  // Sessions
  listSessions: () => request<any[]>("/sessions"),
  createSession: (opts?: { name?: string; workingPath?: string }) =>
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
  abort: (id: string) => request<void>(`/sessions/${id}/abort`, { method: "POST" }),
  compact: (id: string) => request<void>(`/sessions/${id}/compact`, { method: "POST" }),
  getStats: (id: string) => request<any>(`/sessions/${id}/stats`),

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
    request<SkillInfo[]>(`/skills${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`),
  getSkillPaths: () => request<SkillPaths>("/skills/paths"),
  reloadSkills: (sessionId?: string) =>
    request<void>("/skills/reload", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),
};
