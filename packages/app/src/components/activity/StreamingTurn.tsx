import { useSessionStore } from "@/stores/sessionStore";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ToolBlock } from "@/components/tools/ToolBlock";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export function StreamingTurn() {
  const streamingThinking = useSessionStore((s) => s.streamingThinking);
  const streamingBlocks = useSessionStore((s) => s.streamingBlocks);
  const streamingPhase = useSessionStore((s) => s.streamingPhase);

  const hasContent = streamingThinking || streamingBlocks.length > 0;
  const isActive = streamingPhase !== "idle";

  if (!isActive && !hasContent) return null;

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden transition-all duration-200",
        "bg-gradient-to-r from-background to-muted/20",
        "ring-1 ring-amber-500/30 shadow-sm shadow-amber-500/5",
      )}
    >
      {/* Animated left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500 animate-pulse" />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 text-xs">
        <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
        <span className="font-medium text-amber-500">Active</span>

        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          {streamingThinking && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-500 text-[10px] font-medium">
              thinking
            </span>
          )}
          {streamingBlocks.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-medium">
              {streamingBlocks.length} tools
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="border-t border-amber-500/20 px-3 py-2.5 space-y-2 bg-muted/10">
        {streamingThinking && <ThinkingBlock content={streamingThinking} isStreaming />}
        {streamingBlocks.map((tc) => (
          <ToolBlock
            key={tc.id}
            toolCallId={tc.id}
            toolName={tc.name}
            args={JSON.stringify(tc.arguments)}
            isStreaming
          />
        ))}
      </div>
    </div>
  );
}
