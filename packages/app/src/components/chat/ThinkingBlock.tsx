import { useState, useRef, useEffect } from "react";
import { ChevronRight, Brain } from "lucide-react";
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
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/30 transition-colors"
      >
        <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
        <Brain className="w-3 h-3" />
        <span>
          Thinking
          {isStreaming && <span className="ml-1 animate-pulse">...</span>}
        </span>
        <span className="ml-auto text-[10px]">{content.length} chars</span>
      </button>
      {expanded && (
        <div
          ref={contentRef}
          className="px-3 py-2 text-xs text-muted-foreground border-t border-border whitespace-pre-wrap break-words font-mono leading-relaxed max-h-64 overflow-y-auto"
        >
          {content}
        </div>
      )}
    </div>
  );
}
