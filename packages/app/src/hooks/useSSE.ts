import { useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useToolStore } from "@/stores/toolStore";
import { useConfigStore } from "@/stores/configStore";
import { api } from "@/lib/api";
import type { GlobalSSEEvent, ToolCall } from "@friend/shared";

export function useGlobalSSE() {
  // Use selectors for proper subscription
  const setStreaming = useSessionStore((s) => s.setStreaming);
  const setStreamingPhase = useSessionStore((s) => s.setStreamingPhase);
  const appendStreamingText = useSessionStore((s) => s.appendStreamingText);
  const appendStreamingThinking = useSessionStore((s) => s.appendStreamingThinking);
  const addStreamingBlock = useSessionStore((s) => s.addStreamingBlock);
  const resetStreaming = useSessionStore((s) => s.resetStreaming);
  const addMessage = useSessionStore((s) => s.addMessage);
  const setSseConnected = useSessionStore((s) => s.setSseConnected);
  const setSteeringMessages = useSessionStore((s) => s.setSteeringMessages);
  const setFollowUpMessages = useSessionStore((s) => s.setFollowUpMessages);
  const setCompacting = useSessionStore((s) => s.setCompacting);

  const { addExecution, updateExecution, completeExecution, clearExecutions } = useToolStore();

  // Helper to refresh pending messages from backend
  const refreshPendingMessages = async (sessionId: string) => {
    try {
      const res = await api.getPendingMessages(sessionId);
      if (res.ok && res.data) {
        setSteeringMessages(res.data.steering);
        setFollowUpMessages(res.data.followUp);
      }
    } catch {
      // Ignore errors
    }
  };

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let lastEventTime = 0;
    let retryCount = 0;
    const MAX_RETRIES = 10;
    const INITIAL_RETRY_DELAY = 1000; // 1 second
    const MAX_RETRY_DELAY = 30000; // 30 seconds
    const HEARTBEAT_TIMEOUT = 25000; // 25 seconds (server pings every 15s)

    // Calculate retry delay with exponential backoff
    const getRetryDelay = (): number => {
      const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
      // Add some jitter to avoid thundering herd
      return delay + Math.random() * 1000;
    };

    const stopHeartbeatCheck = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    };

    const startHeartbeatCheck = () => {
      stopHeartbeatCheck();
      lastEventTime = Date.now();
      heartbeatInterval = setInterval(() => {
        if (Date.now() - lastEventTime > HEARTBEAT_TIMEOUT) {
          console.warn("[SSE] No heartbeat received, connection appears dead");
          stopHeartbeatCheck();
          setSseConnected(false);
          if (es) {
            es.close();
            es = null;
          }
          scheduleReconnect();
        }
      }, 5000);
    };

    const connect = () => {
      stopHeartbeatCheck();
      if (es) {
        es.close();
      }

      console.log(`[SSE] Connecting (attempt ${retryCount + 1})...`);
      setSseConnected(false);
      es = new EventSource("/api/events");

      // Handle connection errors - any error means disconnected
      es.addEventListener("error", () => {
        console.error("[SSE] Connection error, readyState:", es?.readyState);
        stopHeartbeatCheck();
        setSseConnected(false);
        // Close and reconnect
        if (es && es.readyState !== EventSource.CLOSED) {
          es.close();
        }
        scheduleReconnect();
      });

      // Monitor ready state changes
      const checkState = () => {
        if (!es) return;

        if (es.readyState === EventSource.OPEN) {
          console.log("[SSE] Connection opened");
          retryCount = 0;
          setSseConnected(true);
          // Start heartbeat monitoring once connected
          startHeartbeatCheck();
        } else if (es.readyState === EventSource.CLOSED) {
          console.error("[SSE] Connection closed");
          setSseConnected(false);
        } else if (es.readyState === EventSource.CONNECTING) {
          console.log("[SSE] Connecting...");
        }
      };

      // Check state immediately and on change
      checkState();
      es.addEventListener("open", checkState);

      // Listen for server ping events to track heartbeat
      es.addEventListener("ping", () => {
        lastEventTime = Date.now();
      });

      // Register data event listeners on this new connection
      for (const t of eventTypes) {
        es.addEventListener(t, handleEvent);
      }
    };

    const scheduleReconnect = () => {
      if (retryCount >= MAX_RETRIES) {
        console.error("[SSE] Max retry attempts reached, giving up");
        setSseConnected(false);
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
      // Any event from server proves connection is alive
      lastEventTime = Date.now();
      try {
        const event: GlobalSSEEvent = JSON.parse(e.data);

        // Handle global config events (sessionId: "__system__") before session filter
        if (event.type === "config_updated") {
          useConfigStore.getState()._applyConfigEvent(event);
          return;
        }

        // Handle session created event - add to session list and navigate
        if (event.type === "session_created") {
          const newSession = {
            id: event.newSessionId,
            name: event.name,
            agentId: event.agentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 0,
            workingPath: event.workingPath,
          };
          useSessionStore.getState().addSession(newSession);
          useSessionStore.getState().setActiveSession(event.newSessionId);
          return;
        }

        // Handle session rename before session filter (updates sidebar for any session)
        if (event.type === "session_renamed") {
          const sessions = useSessionStore.getState().sessions;
          useSessionStore
            .getState()
            .setSessions(
              sessions.map((s) => (s.id === event.sessionId ? { ...s, name: event.newName } : s)),
            );
          return;
        }

        // Get current activeSessionId directly from store (not from stale ref)
        const currentActiveSessionId = useSessionStore.getState().activeSessionId;
        if (event.sessionId !== currentActiveSessionId) return;

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
            // Refresh pending messages when a user message is delivered
            if (event.message.role === "user") {
              refreshPendingMessages(event.sessionId);
            }
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

          case "auto_compaction_start":
            console.log("[SSE] Auto compaction started:", event.reason);
            setCompacting(true);
            break;

          case "auto_compaction_end":
            console.log("[SSE] Auto compaction ended");
            setCompacting(false);
            break;

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
      "session_created",
      "config_updated",
    ];

    // Initial connection
    connect();

    // Cleanup
    return () => {
      stopHeartbeatCheck();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (es) {
        es.close();
      }
    };
  }, []);
}
