import { useState, useEffect } from "react";
import { ChevronRight, Brain, Wrench } from "lucide-react";
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
  const text =
    typeof msg.content === "string"
      ? msg.content
      : msg.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
  return text.length > 80 ? text.slice(0, 80) + "..." : text;
}

type ActivityBlock =
  | { kind: "thinking"; content: string }
  | { kind: "toolCall"; id: string; name: string; args: string };

export function TurnGroup({ turn, defaultExpanded = false }: TurnGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const activeTurnIndex = useSessionStore((s) => s.activeTurnIndex);

  // Expand when this turn is activated from chat click
  useEffect(() => {
    if (activeTurnIndex === turn.index) {
      setExpanded(true);
    }
  }, [activeTurnIndex, turn.index]);

  // Collect blocks in original order
  const blocks: ActivityBlock[] = [];
  let thinkingCount = 0;
  let toolCount = 0;

  for (const msg of turn.assistantMessages) {
    for (const block of msg.content) {
      if (block.type === "thinking") {
        blocks.push({ kind: "thinking", content: block.thinking });
        thinkingCount++;
      } else if (block.type === "toolCall") {
        blocks.push({
          kind: "toolCall",
          id: block.id,
          name: block.name,
          args: JSON.stringify(block.arguments),
        });
        toolCount++;
      }
    }
  }

  if (blocks.length === 0) return null;

  const isActive = activeTurnIndex === turn.index;

  return (
    <div
      className={cn(
        "relative group rounded-lg overflow-hidden transition-all duration-200",
        "bg-gradient-to-r from-background to-muted/20",
        isActive
          ? "ring-1 ring-primary/30 shadow-sm shadow-primary/5"
          : "border border-border/40 hover:border-border/60",
      )}
    >
      {/* Left accent bar */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-0.5 transition-colors",
          isActive ? "bg-primary" : "bg-transparent group-hover:bg-muted-foreground/20",
        )}
      />

      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs hover:bg-muted/30 transition-colors"
      >
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0",
            expanded && "rotate-90",
          )}
        />

        <span className="flex-1 truncate text-muted-foreground text-left">
          {getUserPreview(turn.userMessage)}
        </span>

        {/* Stats badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {thinkingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-500 text-[10px] font-medium">
              <Brain className="w-2.5 h-2.5" />
              {thinkingCount}
            </span>
          )}
          {toolCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-medium">
              <Wrench className="w-2.5 h-2.5" />
              {toolCount}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/30 px-3 py-2.5 space-y-2 bg-muted/10">
          {[...blocks]
            .reverse()
            .map((block, i) =>
              block.kind === "thinking" ? (
                <ThinkingBlock
                  key={`thinking-${i}`}
                  content={block.content}
                  defaultExpanded={defaultExpanded}
                />
              ) : (
                <ToolBlock
                  key={block.id}
                  toolCallId={block.id}
                  toolName={block.name}
                  args={block.args}
                  toolResult={turn.toolResults.get(block.id)}
                />
              ),
            )}
        </div>
      )}
    </div>
  );
}
