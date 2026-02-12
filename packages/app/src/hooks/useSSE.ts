import { useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useToolStore } from "@/stores/toolStore";
import { useConfigStore } from "@/stores/configStore";
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
    let es: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 10;
    const INITIAL_RETRY_DELAY = 1000; // 1 second
    const MAX_RETRY_DELAY = 30000; // 30 seconds

    // Calculate retry delay with exponential backoff
    const getRetryDelay = (): number => {
      const delay = Math.min(
        INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
        MAX_RETRY_DELAY
      );
      // Add some jitter to avoid thundering herd
      return delay + Math.random() * 1000;
    };

    const connect = () => {
      if (es) {
        es.close();
      }

      console.log(`[SSE] Connecting (attempt ${retryCount + 1})...`);
      es = new EventSource("/api/events");

      // Connection opened
      if (es.readyState === EventSource.OPEN) {
        console.log("[SSE] Connected");
        retryCount = 0;
      }

      // Handle connection errors
      es.addEventListener("error", (e) => {
        if (es?.readyState === EventSource.CLOSED) {
          console.error("[SSE] Connection closed, will retry...");
          scheduleReconnect();
        }
      });

      // Monitor ready state changes
      const checkState = () => {
        if (!es) return;

        if (es.readyState === EventSource.OPEN) {
          console.log("[SSE] Connection opened");
          retryCount = 0;
        } else if (es.readyState === EventSource.CLOSED) {
          console.error("[SSE] Connection closed");
        } else if (es.readyState === EventSource.CONNECTING) {
          console.log("[SSE] Connecting...");
        }
      };

      // Check state immediately and on change
      checkState();
      es.addEventListener("open", checkState);
    };

    const scheduleReconnect = () => {
      if (retryCount >= MAX_RETRIES) {
        console.error("[SSE] Max retry attempts reached, giving up");
        return;
      }

      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }

      const delay = getRetryDelay();
      console.log(`[SSE] Will reconnect in ${Math.round(delay)}ms...`);

      retryTimeout = setTimeout(() => {
        retryCount++;
        connect();
      }, delay);
    };

    const handleEvent = (e: MessageEvent) => {
      try {
        const event: GlobalSSEEvent = JSON.parse(e.data);

        // Handle global config events (sessionId: "__system__") before session filter
        if (event.type === "config_updated") {
          useConfigStore.getState()._applyConfigEvent(event);
          return;
        }

        // Handle session rename before session filter (updates sidebar for any session)
        if (event.type === "session_renamed") {
          const sessions = useSessionStore.getState().sessions;
          useSessionStore.getState().setSessions(
            sessions.map((s) =>
              s.id === event.sessionId ? { ...s, name: event.newName } : s,
            ),
          );
          return;
        }

        if (event.sessionId !== activeSessionRef.current) return;

        // Ensure streaming mode is on for events that imply active streaming
        // (handles page refresh where agent_start was missed)
        const impliesStreaming =
          event.type === "message_start" ||
          event.type === "message_update" ||
          event.type === "tool_execution_start" ||
          event.type === "tool_execution_update";
        if (impliesStreaming && !useSessionStore.getState().isStreaming) {
          setStreaming(true);
        }

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

          case "message_update": {
            const ame = event.assistantMessageEvent;
            switch (ame.type) {
              case "text_delta":
                appendStreamingText(ame.delta);
                setStreamingPhase("generating");
                break;
              case "thinking_delta":
                appendStreamingThinking(ame.delta);
                setStreamingPhase("thinking");
                break;
              case "toolcall_start":
                setStreamingPhase("tool_calling");
                break;
              case "toolcall_end": {
                const tc = ame.toolCall;
                const block: ToolCall = {
                  type: "toolCall",
                  id: tc.id,
                  name: tc.name,
                  arguments: tc.arguments,
                };
                addStreamingBlock(block);
                break;
              }
            }
            break;
          }

          case "message_end":
            if (event.message.role === "assistant") {
              addMessage(event.message);
            }
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

          case "tool_execution_update": {
            const result =
              typeof event.partialResult === "string"
                ? event.partialResult
                : JSON.stringify(event.partialResult);
            updateExecution(event.toolCallId, result);
            break;
          }

          case "tool_execution_end": {
            const result =
              typeof event.result === "string" ? event.result : JSON.stringify(event.result);
            completeExecution(event.toolCallId, result, event.isError);
            break;
          }

          case "error":
            console.error("SSE error:", event.message);
            setStreaming(false);
            setStreamingPhase("idle");
            break;
        }
      } catch (err) {
        console.error("[SSE] Failed to parse event:", err);
      }
    };

    // SDK events use top-level type names
    const eventTypes = [
      "agent_start",
      "agent_end",
      "turn_start",
      "turn_end",
      "message_start",
      "message_update",
      "message_end",
      "tool_execution_start",
      "tool_execution_update",
      "tool_execution_end",
      "auto_compaction_start",
      "auto_compaction_end",
      "auto_retry_start",
      "auto_retry_end",
      "error",
      "session_updated",
      "session_renamed",
      "config_updated",
    ];

    // Initial connection
    connect();

    // Register event listeners on the current connection
    const registerListeners = (currentEs: EventSource) => {
      for (const t of eventTypes) {
        currentEs.addEventListener(t, handleEvent);
      }
    };

    // Track current connection and update listeners
    const updateListeners = () => {
      if (es) {
        registerListeners(es);
      }
    };

    updateListeners();

    // Cleanup
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (es) {
        es.close();
      }
    };
  }, []);
}
