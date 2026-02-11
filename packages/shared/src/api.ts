import type { CustomProviderConfig } from "./models.js";

// REST API request/response types

// Sessions
export interface CreateSessionRequest {
  name?: string;
}

export interface PromptRequest {
  message: string;
}

export interface SteerRequest {
  message: string;
}

export interface SwitchModelRequest {
  provider: string;
  modelId: string;
}

export interface UpdateConfigRequest {
  thinkingLevel?: string;
}

export interface SetAuthRequest {
  provider: string;
  apiKey: string;
}

export interface AddCustomProviderRequest extends CustomProviderConfig {}

export interface RemoveCustomProviderRequest {
  name: string;
}

// Responses
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface SessionStatsResponse {
  messageCount: number;
  tokenCount?: number;
  cost?: number;
}
