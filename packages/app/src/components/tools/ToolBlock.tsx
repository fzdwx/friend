import { useState } from "react";
import { Loader2, Check, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToolStore } from "@/stores/toolStore";
import { getToolRenderer } from "./registry/registry.js";
import type { ToolResultMessage } from "@friend/shared";

interface ToolBlockProps {
  toolCallId: string;
  toolName: string;
  args: string;
  isStreaming?: boolean;
  toolResult?: ToolResultMessage;
}

/** Extract text from a ToolResultMessage's content array */
function extractResultText(tr: ToolResultMessage): string {
  return tr.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export function ToolBlock({ toolCallId, toolName, args, isStreaming, toolResult }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const execution = useToolStore((s) => s.executions.find((e) => e.toolCallId === toolCallId));

  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = JSON.parse(args);
  } catch {
    if (execution) parsedArgs = execution.args;
  }

  const renderer = getToolRenderer(toolName);
  const fullSummary = renderer.getFullSummary?.(parsedArgs) || renderer.getSummary(parsedArgs);
  const summary = renderer.getSummary(parsedArgs);

  // Derive result: prefer toolResult prop (stable for historical), fallback to toolStore (live for streaming)
  const resultText = toolResult ? extractResultText(toolResult) : execution?.result;
  const isError = toolResult?.isError ?? execution?.isError ?? false;

  // Derive phase
  let phase: "calling" | "executing" | "completed" | "error";
  if (isStreaming) {
    phase = execution
      ? execution.status === "running"
        ? "executing"
        : execution.isError
          ? "error"
          : "completed"
      : "calling";
  } else {
    phase = toolResult
      ? toolResult.isError
        ? "error"
        : "completed"
      : execution
        ? execution.status === "running"
          ? "executing"
          : execution.isError
            ? "error"
            : "completed"
        : "completed";
  }

  // Status colors
  const statusConfig = {
    calling: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/5",
      accent: "bg-amber-500",
      icon: <Loader2 className="w-3 h-3 animate-spin text-amber-500" />,
    },
    executing: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/5",
      accent: "bg-amber-500",
      icon: <Loader2 className="w-3 h-3 animate-spin text-amber-500" />,
    },
    completed: {
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      accent: "bg-emerald-500",
      icon: <Check className="w-3 h-3 text-emerald-500" />,
    },
    error: {
      border: "border-red-500/30",
      bg: "bg-red-500/5",
      accent: "bg-red-500",
      icon: <X className="w-3 h-3 text-red-500" />,
    },
  };

  const status = statusConfig[phase];

  const hasResult = resultText != null;
  const hasResultRenderer = renderer.ResultComponent != null;
  const canExpand = hasResult && hasResultRenderer;

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden transition-all duration-200 border",
        status.border,
        status.bg,
        canExpand && "hover:border-border/60",
      )}
    >
      {/* Left accent bar + Header */}
      <div className="flex">
        {/* Left accent bar */}
        <div
          className={cn(
            "w-0.5 flex-shrink-0",
            status.accent,
            phase === "executing" || phase === "calling" ? "animate-pulse" : "",
          )}
        />

        {/* Header content */}
        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          className={cn(
            "flex items-center gap-2.5 w-full px-3 py-2 text-xs",
            canExpand && "cursor-pointer",
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

          <div
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded-md",
              "bg-muted/50 text-muted-foreground",
            )}
          >
            {renderer.icon}
          </div>

          <span className="font-medium text-foreground">{toolName}</span>

          <span 
            className="truncate text-muted-foreground flex-1 text-left" 
            title={fullSummary}
          >
            {summary}
          </span>

          <div className="flex-shrink-0">{status.icon}</div>
        </button>
      </div>

      {/* Result body */}
      {expanded && hasResult && renderer.ResultComponent && (
        <div className="border-t border-border/30 max-h-52 overflow-y-auto">
          <renderer.ResultComponent args={parsedArgs} result={resultText!} isError={isError} />
        </div>
      )}
    </div>
  );
}
