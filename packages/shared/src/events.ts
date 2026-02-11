// SSE Event types sent from server to frontend

export type SSEEvent =
  | AgentStartEvent
  | AgentEndEvent
  | TurnStartEvent
  | TurnEndEvent
  | MessageStartEvent
  | MessageEndEvent
  | TextDeltaEvent
  | ThinkingDeltaEvent
  | ToolCallStartEvent
  | ToolCallDeltaEvent
  | ToolCallEndEvent
  | ToolExecutionStartEvent
  | ToolExecutionUpdateEvent
  | ToolExecutionEndEvent
  | ErrorEvent
  | SessionUpdatedEvent;

export interface AgentStartEvent {
  type: "agent_start";
}

export interface AgentEndEvent {
  type: "agent_end";
}

export interface TurnStartEvent {
  type: "turn_start";
}

export interface TurnEndEvent {
  type: "turn_end";
}

export interface MessageStartEvent {
  type: "message_start";
  messageId: string;
  role: "assistant" | "user";
}

export interface MessageEndEvent {
  type: "message_end";
  messageId: string;
}

export interface TextDeltaEvent {
  type: "text_delta";
  content: string;
}

export interface ThinkingDeltaEvent {
  type: "thinking_delta";
  content: string;
}

export interface ToolCallStartEvent {
  type: "tool_call_start";
  toolCallId: string;
  toolName: string;
}

export interface ToolCallDeltaEvent {
  type: "tool_call_delta";
  toolCallId: string;
  content: string;
}

export interface ToolCallEndEvent {
  type: "tool_call_end";
  toolCallId: string;
  toolName: string;
  args: string;
}

export interface ToolExecutionStartEvent {
  type: "tool_execution_start";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolExecutionUpdateEvent {
  type: "tool_execution_update";
  toolCallId: string;
  toolName: string;
  result: string;
}

export interface ToolExecutionEndEvent {
  type: "tool_execution_end";
  toolCallId: string;
  toolName: string;
  result: string;
  isError: boolean;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export interface SessionUpdatedEvent {
  type: "session_updated";
  sessionId: string;
}

/** Wire format: every event carries a sessionId for multiplexing */
export type GlobalSSEEvent = SSEEvent & { sessionId: string };
