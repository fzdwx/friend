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
};
