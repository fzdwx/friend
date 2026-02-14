import { useMemo, useRef, useEffect } from "react";
import { Activity, Circle, Radio } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import type { Message, UserMessage, AssistantMessage, ToolResultMessage } from "@friend/shared";
import { TurnGroup, type Turn } from "@/components/activity/TurnGroup";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const messages = useSessionStore((s) => s.messages);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const sseConnected = useSessionStore((s) => s.sseConnected);
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
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <span>{t("activity.title")}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasTurns ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground/60 p-6">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
              <Radio className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <p className="text-center whitespace-pre-line">
              {t("activity.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div ref={topRef} />
            {reversedTurns.map((turn) => (
              <TurnGroup
                key={`turn-${turn.index}`}
                turn={turn}
                defaultExpanded={turn.index === turns.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* SSE Connection Status Footer */}
      <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20">
        <div className="flex items-center gap-2 text-xs">
          <Circle
            className={cn(
              "w-2 h-2",
              isStreaming
                ? "fill-yellow-500 text-yellow-500 animate-pulse"
                : sseConnected
                  ? "fill-emerald-500 text-emerald-500"
                  : "fill-red-500 text-red-500",
            )}
          />
          <span
            className={cn(
              "font-medium",
              isStreaming
                ? "text-yellow-500"
                : sseConnected
                  ? "text-emerald-500"
                  : "text-red-500",
            )}
          >
            {isStreaming ? t("activity.streaming") : sseConnected ? t("activity.connected") : t("activity.disconnected")}
          </span>
        </div>
      </div>
    </div>
  );
}
