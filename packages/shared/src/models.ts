// Session types
export interface SessionInfo {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  model?: string;
  messageCount: number;
  workingPath?: string;
}

export interface SessionDetail extends SessionInfo {
  messages: ChatMessage[];
}

// Message types
export type ChatMessage = UserChatMessage | AssistantChatMessage | ToolResultChatMessage;

export interface UserChatMessage {
  role: "user";
  id: string;
  content: string;
  timestamp: string;
}

export interface AssistantChatMessage {
  role: "assistant";
  id: string;
  content: AssistantContentBlock[];
  timestamp: string;
}

export interface ToolResultChatMessage {
  role: "tool_result";
  id: string;
  toolCallId: string;
  toolName: string;
  result: string;
  isError: boolean;
  timestamp: string;
}

export type AssistantContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; toolCallId: string; toolName: string; args: string };

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
}
