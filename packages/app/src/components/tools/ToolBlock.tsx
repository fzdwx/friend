import { useState } from "react";
import { Loader2, Check, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToolStore } from "@/stores/toolStore";
import { getToolRenderer } from "./registry/registry.js";

interface ToolBlockProps {
  toolCallId: string;
  toolName: string;
  args: string;
  isStreaming?: boolean;
}

export function ToolBlock({ toolCallId, toolName, args, isStreaming }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const execution = useToolStore((s) =>
    s.executions.find((e) => e.toolCallId === toolCallId),
  );

  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = JSON.parse(args);
  } catch {
    // use execution args as fallback
    if (execution) parsedArgs = execution.args;
  }

  const renderer = getToolRenderer(toolName);
  const summary = renderer.getSummary(parsedArgs);

  // Derive phase from execution state
  const phase = !execution
    ? "calling"
    : execution.status === "running"
      ? "executing"
      : execution.isError
        ? "error"
        : "completed";

  const statusIcon =
    phase === "calling" || phase === "executing" ? (
      <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
    ) : phase === "error" ? (
      <X className="w-3 h-3 text-destructive" />
    ) : (
      <Check className="w-3 h-3 text-emerald-500" />
    );

  const hasResult = execution?.result != null;
  const hasResultRenderer = renderer.ResultComponent != null;
  const canExpand = hasResult && hasResultRenderer;

  return (
    <div className="rounded-md border border-border/50 bg-secondary/30 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-1.5 text-xs",
          canExpand && "cursor-pointer hover:bg-secondary/60",
          !canExpand && "cursor-default",
        )}
      >
        {canExpand && (
          <ChevronRight
            className={cn(
              "w-3 h-3 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
        )}
        {renderer.icon}
        <span className="font-medium">{toolName}</span>
        <span className="truncate text-muted-foreground flex-1 text-left">{summary}</span>
        {statusIcon}
      </button>

      {/* Result body */}
      {expanded && hasResult && renderer.ResultComponent && (
        <div className="border-t border-border/50 max-h-60 overflow-y-auto">
          <renderer.ResultComponent
            args={parsedArgs}
            result={execution!.result!}
            isError={execution!.isError ?? false}
          />
        </div>
      )}
    </div>
  );
}
