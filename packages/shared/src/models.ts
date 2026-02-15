// Re-export pi-ai message types
export type {
  Message,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  TextContent,
  ThinkingContent,
  ToolCall,
  ImageContent,
  Usage,
  StopReason,
} from "@mariozechner/pi-ai";

import type { Message } from "@mariozechner/pi-ai";
import type { Question } from "./events.js";

// Session types
export interface SessionInfo {
  id: string;
  name: string;
  agentId?: string;  // Agent this session belongs to
  createdAt: string;
  updatedAt: string;
  model?: string;
  messageCount: number;
  workingPath?: string;
  isStreaming?: boolean;  // Whether the session is currently streaming
}

export interface SessionDetail extends SessionInfo {
  messages: Message[];
  isStreaming?: boolean;
  planModeState?: {
    enabled: boolean;
    executing: boolean;
    todos: Array<{ step: number; text: string; completed: boolean }>;
  };
  pendingQuestion?: {
    questionId: string;
    questions: Question[];
  };
}

// Model types
export interface ModelInfo {
  provider: string;
  id: string;
  name: string;
  available?: boolean;
}

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

// Theme types
export type ThemeMode = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export interface ColorDefinition {
  l: number;
  c: number;
  h: number;
}

export interface ColorSet {
  background: ColorDefinition;
  foreground: ColorDefinition;
  card: ColorDefinition;
  cardForeground: ColorDefinition;
  popover: ColorDefinition;
  popoverForeground: ColorDefinition;
  primary: ColorDefinition;
  primaryForeground: ColorDefinition;
  secondary: ColorDefinition;
  secondaryForeground: ColorDefinition;
  muted: ColorDefinition;
  mutedForeground: ColorDefinition;
  accent: ColorDefinition;
  accentForeground: ColorDefinition;
  destructive: ColorDefinition;
  destructiveForeground: ColorDefinition;
  border: ColorDefinition;
  input: ColorDefinition;
  ring: ColorDefinition;
  sidebar: ColorDefinition;
  sidebarForeground: ColorDefinition;
  sidebarBorder: ColorDefinition;
}

export interface ThemeConfig {
  id: string;
  name: string;
  mode: ThemeMode;
  colors: ColorSet;
  isPreset: boolean;
  isBuiltIn: boolean;
}

// Custom provider
export interface CustomProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  api?: string;
  headers?: Record<string, string>;
  models: CustomModelConfig[];
}

export interface CustomModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
}

// Config
export interface AppConfig {
  thinkingLevel: ThinkingLevel;
  customProviders: CustomProviderConfig[];
  activeThemeId: string;
  // Embedding provider for memory search
  embedding?: EmbeddingConfig;
}

// Embedding configuration
export interface EmbeddingConfig {
  provider: "openai" | "gemini" | "voyage" | "auto";
  model?: string;  // Optional model override
}
