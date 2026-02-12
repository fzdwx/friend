// SSE Event types sent from server to frontend
// Re-use SDK event types directly; only define app-specific extras.

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

export interface ConfigUpdatedEvent {
  type: "config_updated";
  activeThemeId?: string;
  addedTheme?: ThemeConfig;
  updatedTheme?: ThemeConfig;
  deletedThemeId?: string;
}

export type SSEEvent =
  | AgentSessionEvent
  | ErrorEvent
  | SessionUpdatedEvent
  | SessionRenamedEvent
  | ConfigUpdatedEvent;

/** Wire format: every event carries a sessionId for multiplexing */
export type GlobalSSEEvent = SSEEvent & { sessionId: string };
