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

/** Plan mode state (serializable for persistence) */
export interface PlanModeState {
  enabled: boolean;
  executing: boolean;
  modifying: boolean;  // True when user is modifying existing plan
  modifyMessage?: string;  // The user's modification request
  todos: TodoItem[];
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

// ─── Question Tool Events ─────────────────────────────────────────────────

/** Question option with optional description */
export interface QuestionOption {
  label: string;
  description?: string;
  value?: string;  // Optional: value to return if different from label
}

/** Single question definition */
export interface Question {
  /** Unique ID for this question */
  id: string;
  /** Short label for display (e.g., "Framework") */
  label?: string;
  /** The question text */
  question: string;
  /** Available options */
  options: QuestionOption[];
  /** Allow custom text input (default: true) */
  allowOther?: boolean;
  /** Allow multiple selections (default: false) */
  multiSelect?: boolean;
}

/** User's answer to a single question */
export interface QuestionAnswer {
  questionId: string;
  /** Selected option values/labels or custom text */
  answers: string[];
  /** Whether any answer was custom text */
  wasCustom?: boolean;
}

/** Questionnaire result */
export interface QuestionnaireResult {
  questionId: string;
  answers: QuestionAnswer[];
  cancelled: boolean;
}

/** Agent is asking questions, waiting for user response */
export interface QuestionRequestEvent {
  type: "question_request";
  /** Unique ID for this questionnaire */
  questionId: string;
  /** Questions to ask */
  questions: Question[];
}

/** Pending question state (serializable for persistence) */
export interface PendingQuestion {
  questionId: string;
  questions: Question[];
}

// ─── Slash Commands ───────────────────────────────────────────────────────

export interface SlashCommandInfo {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
  location?: "user" | "project" | "path";
  path?: string;
}

/** Command execution result event */
export interface CommandResultEvent {
  type: "command_result";
  command: string;
  success: boolean;
  message?: string;
}

/** Notification event from ctx.ui.notify() */
export interface NotificationEvent {
  type: "notification";
  message: string;
  /** Notification type: info, warning, or error */
  notificationType?: "info" | "warning" | "error";
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
  | PlanModeCompleteEvent
  | QuestionRequestEvent
  | CommandResultEvent
  | NotificationEvent;

/** Wire format: every event carries a sessionId for multiplexing */
export type GlobalSSEEvent = SSEEvent & { sessionId: string };
