import type { CustomProviderConfig } from "@friend/shared";

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
  createSession: (name?: string) =>
    request<any>("/sessions", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  getSession: (id: string) => request<any>(`/sessions/${id}`),
  deleteSession: (id: string) => request<any>(`/sessions/${id}`, { method: "DELETE" }),
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
  getModels: () => request<any[]>("/models"),
  setModel: (sessionId: string, provider: string, modelId: string) =>
    request<void>(`/sessions/${sessionId}/model`, {
      method: "POST",
      body: JSON.stringify({ provider, modelId }),
    }),
  setThinking: (sessionId: string, level: string) =>
    request<void>(`/sessions/${sessionId}/thinking`, {
      method: "POST",
      body: JSON.stringify({ level }),
    }),

  // Config
  getConfig: () => request<any>("/config"),
  updateConfig: (config: Record<string, unknown>) =>
    request<any>("/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
  setAuth: (provider: string, apiKey: string) =>
    request<void>("/config/auth", {
      method: "PUT",
      body: JSON.stringify({ provider, apiKey }),
    }),

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
};
