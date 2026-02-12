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
  const text =
    typeof msg.content === "string"
      ? msg.content
      : msg.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
  return text.length > 60 ? text.slice(0, 60) + "..." : text;
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
        onClick={() => setExpanded((v) => !v)}
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
          {thinkingCount > 0 && <span>{thinkingCount} thinking</span>}
          {thinkingCount > 0 && toolCount > 0 && <span>·</span>}
          {toolCount > 0 && (
            <span>
              {toolCount} tool{toolCount > 1 ? "s" : ""}
            </span>
          )}
        </span>
      </button>

      {/* Expanded content - renders in original message order */}
      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 space-y-2">
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
