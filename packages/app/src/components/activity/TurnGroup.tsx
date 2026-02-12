import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserMessage, AssistantMessage, ToolResultMessage } from "@friend/shared";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ToolBlock } from "@/components/tools/ToolBlock";
import { useSessionStore } from "@/stores/sessionStore";

export interface Turn {
  index: number;
  userMessage: UserMessage;
  assistantMessages: AssistantMessage[];
  toolResults: Map<string, ToolResultMessage>;
}

interface TurnGroupProps {
  turn: Turn;
  defaultExpanded?: boolean;
}

function getUserPreview(msg: UserMessage): string {
  const text = typeof msg.content === "string"
    ? msg.content
    : msg.content.filter(b => b.type === "text").map(b => b.text).join("");
  return text.length > 60 ? text.slice(0, 60) + "..." : text;
}

export function TurnGroup({ turn, defaultExpanded = false }: TurnGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const activeTurnIndex = useSessionStore((s) => s.activeTurnIndex);

  // Expand when this turn is activated from chat click
  useEffect(() => {
    if (activeTurnIndex === turn.index) {
      setExpanded(true);
    }
  }, [activeTurnIndex, turn.index]);

  // Collect all thinking blocks and tool calls from assistant messages
  const thinkingBlocks: string[] = [];
  const toolCalls: { id: string; name: string; args: string }[] = [];

  for (const msg of turn.assistantMessages) {
    for (const block of msg.content) {
      if (block.type === "thinking") {
        thinkingBlocks.push(block.thinking);
      } else if (block.type === "toolCall") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          args: JSON.stringify(block.arguments),
        });
      }
    }
  }

  const hasActivity = thinkingBlocks.length > 0 || toolCalls.length > 0;
  if (!hasActivity) return null;

  return (
    <div
      className={cn(
        "border rounded-md overflow-hidden transition-colors",
        activeTurnIndex === turn.index ? "border-primary/50" : "border-border/50",
      )}
    >
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-secondary/40 transition-colors"
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 text-muted-foreground transition-transform flex-shrink-0",
            expanded && "rotate-90",
          )}
        />
        <span className="font-medium text-muted-foreground">Turn {turn.index + 1}</span>
        <span className="truncate text-muted-foreground/70 flex-1 text-left">
          {getUserPreview(turn.userMessage)}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 flex-shrink-0">
          {thinkingBlocks.length > 0 && <span>{thinkingBlocks.length} thinking</span>}
          {thinkingBlocks.length > 0 && toolCalls.length > 0 && <span>·</span>}
          {toolCalls.length > 0 && <span>{toolCalls.length} tool{toolCalls.length > 1 ? "s" : ""}</span>}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 space-y-2">
          {thinkingBlocks.map((thinking, i) => (
            <ThinkingBlock key={`thinking-${i}`} content={thinking} defaultExpanded={defaultExpanded} />
          ))}
          {toolCalls.map((tc) => (
            <ToolBlock
              key={tc.id}
              toolCallId={tc.id}
              toolName={tc.name}
              args={tc.args}
              toolResult={turn.toolResults.get(tc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
