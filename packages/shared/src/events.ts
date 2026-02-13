// SSE Event types sent from server to frontend
// Re-use SDK event types directly; only define app-specific extras.

/** Server sends a ping every HEARTBEAT_INTERVAL ms to keep SSE alive */
export const HEARTBEAT_INTERVAL = 1_000;

import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type { ThemeConfig } from "./models.js";

export type { AgentSessionEvent };

// App-specific events not in SDK
export interface ErrorEvent {
  type: "error";
  message: string;
}

export interface SessionUpdatedEvent {
  type: "session_updated";
  sessionId: string;
}

export interface SessionRenamedEvent {
  type: "session_renamed";
  newName: string;
  oldName: string;
}

export interface SessionCreatedEvent {
  type: "session_created";
  /** The ID of the newly created session */
  newSessionId: string;
  agentId: string;
  name: string;
  workingPath?: string;
}

export interface ConfigUpdatedEvent {
  type: "config_updated";
  activeThemeId?: string;
  addedTheme?: ThemeConfig;
  updatedTheme?: ThemeConfig;
  deletedThemeId?: string;
}

// ─── Plan Mode Events ─────────────────────────────────────────────────────

export interface TodoItem {
  step: number;
  text: string;
  completed: boolean;
  subtasks?: TodoItem[];  // Optional nested subtasks
}

/** Plan mode state changed */
export interface PlanModeStateChangedEvent {
  type: "plan_mode_state_changed";
  enabled: boolean;
  executing: boolean;
  todos: TodoItem[];
}

/** Agent finished planning, requesting user action */
export interface PlanModeRequestChoiceEvent {
  type: "plan_mode_request_choice";
  todos: TodoItem[];
}

/** Progress update during plan execution */
export interface PlanModeProgressEvent {
  type: "plan_mode_progress";
  completed: number;
  total: number;
}

/** Plan execution completed */
export interface PlanModeCompleteEvent {
  type: "plan_mode_complete";
  todos: TodoItem[];
}

export type SSEEvent =
  | AgentSessionEvent
  | ErrorEvent
  | SessionUpdatedEvent
  | SessionRenamedEvent
  | SessionCreatedEvent
  | ConfigUpdatedEvent
  | PlanModeStateChangedEvent
  | PlanModeRequestChoiceEvent
  | PlanModeProgressEvent
  | PlanModeCompleteEvent;

/** Wire format: every event carries a sessionId for multiplexing */
export type GlobalSSEEvent = SSEEvent & { sessionId: string };
