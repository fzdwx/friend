import { useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useToolStore } from "@/stores/toolStore";
import type { GlobalSSEEvent, ToolCall } from "@friend/shared";

export function useGlobalSSE() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const activeSessionRef = useRef(activeSessionId);
  activeSessionRef.current = activeSessionId;

  const {
    setStreaming,
    setStreamingPhase,
    appendStreamingText,
    appendStreamingThinking,
    addStreamingBlock,
    resetStreaming,
    addMessage,
  } = useSessionStore();

  const { addExecution, updateExecution, completeExecution, clearExecutions } = useToolStore();

  useEffect(() => {
    const es = new EventSource("/api/events");

    const handleEvent = (e: MessageEvent) => {
      const event: GlobalSSEEvent = JSON.parse(e.data);
      if (event.sessionId !== activeSessionRef.current) return;

      switch (event.type) {
        case "agent_start":
          setStreaming(true);
          setStreamingPhase("started");
          clearExecutions();
          break;

        case "agent_end":
          setStreaming(false);
          setStreamingPhase("idle");
          break;

        case "message_start":
          resetStreaming();
          setStreamingPhase("started");
          break;

        case "text_delta":
          appendStreamingText(event.content);
          setStreamingPhase("generating");
          break;

        case "thinking_delta":
          appendStreamingThinking(event.content);
          setStreamingPhase("thinking");
          break;

        case "tool_call_start":
          setStreamingPhase("tool_calling");
          break;

        case "tool_call_end":
          {
            const block: ToolCall = {
              type: "toolCall",
              id: event.toolCallId,
              name: event.toolName,
              arguments: JSON.parse(event.args),
            };
            addStreamingBlock(block);
          }
          break;

        case "message_end":
          addMessage(event.message);
          resetStreaming();
          break;

        case "tool_execution_start":
          setStreamingPhase("tool_executing");
          addExecution({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            status: "running",
            startTime: new Date().toISOString(),
          });
          break;

        case "tool_execution_update":
          updateExecution(event.toolCallId, event.result);
          break;

        case "tool_execution_end":
          completeExecution(event.toolCallId, event.result, event.isError);
          break;

        case "error":
          console.error("SSE error:", event.message);
          setStreaming(false);
          setStreamingPhase("idle");
          break;
      }
    };

    es.addEventListener("agent_start", handleEvent);
    es.addEventListener("agent_end", handleEvent);
    es.addEventListener("message_start", handleEvent);
    es.addEventListener("text_delta", handleEvent);
    es.addEventListener("thinking_delta", handleEvent);
    es.addEventListener("tool_call_start", handleEvent);
    es.addEventListener("tool_call_delta", handleEvent);
    es.addEventListener("tool_call_end", handleEvent);
    es.addEventListener("message_end", handleEvent);
    es.addEventListener("tool_execution_start", handleEvent);
    es.addEventListener("tool_execution_update", handleEvent);
    es.addEventListener("tool_execution_end", handleEvent);
    es.addEventListener("error", handleEvent);
    es.addEventListener("turn_start", handleEvent);
    es.addEventListener("turn_end", handleEvent);
    es.addEventListener("session_updated", handleEvent);

    return () => {
      es.close();
    };
  }, []);
}
