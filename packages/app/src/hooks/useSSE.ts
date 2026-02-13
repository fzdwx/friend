import { useEffect } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useToolStore } from "@/stores/toolStore";
import { useConfigStore } from "@/stores/configStore";
import { api } from "@/lib/api";
import type { GlobalSSEEvent, ToolCall } from "@friend/shared";

/**
 * Parse SSE text stream into {event, data} pairs.
 * SSE format: "event: <name>\ndata: <json>\n\n"
 */
function* parseSSE(chunk: string, buffer: { value: string }) {
  buffer.value += chunk;
  const parts = buffer.value.split("\n\n");
  // Last element is incomplete — keep it in buffer
  buffer.value = parts.pop()!;

  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data = line.slice(5).trim();
      }
    }
    if (data) yield { event, data };
  }
}

export function useGlobalSSE() {
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
    let abortController: AbortController | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let disposed = false;
    const MAX_RETRIES = 10;
    const INITIAL_RETRY_DELAY = 1000;
    const MAX_RETRY_DELAY = 30000;

    const getRetryDelay = (): number => {
      const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
      return delay + Math.random() * 1000;
    };

    const handleEvent = (eventType: string, data: string) => {
      try {
        // Ping is just a heartbeat, no data to process
        if (eventType === "ping" || eventType === "connected") return;

        const event: GlobalSSEEvent = JSON.parse(data);

        if (event.type === "config_updated") {
          useConfigStore.getState()._applyConfigEvent(event);
          return;
        }

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

        if (event.type === "session_renamed") {
          const sessions = useSessionStore.getState().sessions;
          useSessionStore
            .getState()
            .setSessions(
              sessions.map((s) => (s.id === event.sessionId ? { ...s, name: event.newName } : s)),
            );
          return;
        }

        const currentActiveSessionId = useSessionStore.getState().activeSessionId;
        if (event.sessionId !== currentActiveSessionId) return;

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

    const connect = async () => {
      if (disposed) return;

      abortController?.abort();
      abortController = new AbortController();

      console.log(`[SSE] Connecting (attempt ${retryCount + 1})...`);
      setSseConnected(false);

      try {
        const res = await fetch("/api/events", {
          signal: abortController.signal,
          headers: { Accept: "text/event-stream" },
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        console.log("[SSE] Connection opened");
        retryCount = 0;
        setSseConnected(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const buffer = { value: "" };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          for (const { event, data } of parseSSE(text, buffer)) {
            handleEvent(event, data);
          }
        }

        // Stream ended normally (server closed)
        console.log("[SSE] Stream ended");
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error("[SSE] Connection error:", err);
      }

      // Disconnected — schedule reconnect
      if (!disposed) {
        setSseConnected(false);
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      if (retryCount >= MAX_RETRIES) {
        console.error("[SSE] Max retry attempts reached, giving up");
        setSseConnected(false);
        return;
      }

      if (retryTimeout) clearTimeout(retryTimeout);

      const delay = getRetryDelay();
      console.log(`[SSE] Will reconnect in ${Math.round(delay)}ms...`);

      retryTimeout = setTimeout(() => {
        retryCount++;
        connect();
      }, delay);
    };

    connect();

    return () => {
      disposed = true;
      abortController?.abort();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);
}
