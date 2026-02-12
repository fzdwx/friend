import { useMemo, useRef, useEffect } from "react";
import { Activity, Circle } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import type { Message, UserMessage, AssistantMessage, ToolResultMessage } from "@friend/shared";
import { TurnGroup, type Turn } from "@/components/activity/TurnGroup";
import { cn } from "@/lib/utils";

function groupByTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | null = null;

  for (const msg of messages) {
    if (msg.role === "user") {
      current = {
        index: turns.length,
        userMessage: msg as UserMessage,
        assistantMessages: [],
        toolResults: new Map(),
      };
      turns.push(current);
    } else if (msg.role === "assistant" && current) {
      current.assistantMessages.push(msg as AssistantMessage);
    } else if (msg.role === "toolResult" && current) {
      const tr = msg as ToolResultMessage;
      current.toolResults.set(tr.toolCallId, tr);
    }
  }
  return turns;
}

export function ActivityPanel() {
  const messages = useSessionStore((s) => s.messages);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const topRef = useRef<HTMLDivElement>(null);

  const turns = useMemo(() => groupByTurns(messages), [messages]);

  // Newest turns first (reversed)
  const reversedTurns = useMemo(() => [...turns].reverse(), [turns]);

  // Auto-scroll to top when streaming (newest is at top)
  useEffect(() => {
    if (isStreaming) {
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isStreaming, turns]);

  const hasTurns = turns.length > 0 || isStreaming;

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="w-4 h-4" />
          Activity
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {!hasTurns ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            Thinking and tool activity will appear here
          </div>
        ) : (
          <>
            <div ref={topRef} />
            {reversedTurns.map((turn) => (
              <TurnGroup
                key={`turn-${turn.index}`}
                turn={turn}
                defaultExpanded={turn.index === turns.length - 1}
              />
            ))}
          </>
        )}
      </div>

      {/* SSE Connection Status Footer */}
      <div className="px-3 py-2 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Circle
            className={cn(
              "w-2 h-2 fill-current",
              isStreaming ? "text-yellow-500 animate-pulse" : "text-emerald-500",
            )}
          />
          <span className="font-medium">{isStreaming ? "Streaming" : "Connected"}</span>
        </div>
      </div>
    </div>
  );
}
