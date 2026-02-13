import { useState, useRef, useEffect } from "react";
import { ChevronRight, Brain, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  defaultExpanded?: boolean;
}

export function ThinkingBlock({ content, isStreaming, defaultExpanded }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? isStreaming);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content grows during streaming
  useEffect(() => {
    if (expanded && isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, expanded, isStreaming]);

  if (!content) return null;

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden transition-all duration-200",
        "bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-fuchsia-500/5",
        "border border-violet-500/20",
        isStreaming && "ring-1 ring-violet-500/30",
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors",
          "hover:bg-violet-500/5",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded-md",
            "bg-violet-500/10 text-violet-500",
            isStreaming && "animate-pulse",
          )}
        >
          {isStreaming ? (
            <Sparkles className="w-3 h-3" />
          ) : (
            <Brain className="w-3 h-3" />
          )}
        </div>

        <ChevronRight
          className={cn(
            "w-3 h-3 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />

        <span className="font-medium text-violet-500/80">
          {isStreaming ? "Thinking..." : "Thought"}
        </span>

        <span className="ml-auto text-[10px] text-muted-foreground/50 tabular-nums">
          {content.length} chars
        </span>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-violet-500/10">
          <div
            ref={contentRef}
            className="px-3 py-2.5 text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono leading-relaxed max-h-48 overflow-y-auto scrollbar-thin"
          >
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
