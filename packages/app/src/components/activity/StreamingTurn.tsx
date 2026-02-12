import { useSessionStore } from "@/stores/sessionStore";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ToolBlock } from "@/components/tools/ToolBlock";

export function StreamingTurn() {
  const streamingThinking = useSessionStore((s) => s.streamingThinking);
  const streamingBlocks = useSessionStore((s) => s.streamingBlocks);
  const streamingPhase = useSessionStore((s) => s.streamingPhase);

  const hasContent = streamingThinking || streamingBlocks.length > 0;
  const isActive = streamingPhase !== "idle";

  if (!isActive && !hasContent) return null;

  return (
    <div className="border border-yellow-500/30 rounded-md overflow-hidden bg-yellow-500/5">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
        <span className="font-medium text-yellow-500/80">Current</span>
      </div>

      {/* Content */}
      <div className="px-3 pb-2 space-y-2">
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
