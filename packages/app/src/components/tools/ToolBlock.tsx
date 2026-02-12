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
  const summary = renderer.getSummary(parsedArgs);

  // Derive result: prefer toolResult prop (stable for historical), fallback to toolStore (live for streaming)
  const resultText = toolResult ? extractResultText(toolResult) : execution?.result;
  const isError = toolResult?.isError ?? execution?.isError ?? false;

  // Derive phase
  // For streaming (live) tool calls: use toolStore execution status
  // For historical tool calls: use toolResult prop, never show spinner
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

  const statusIcon =
    phase === "calling" || phase === "executing" ? (
      <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
    ) : phase === "error" ? (
      <X className="w-3 h-3 text-destructive" />
    ) : (
      <Check className="w-3 h-3 text-emerald-500" />
    );

  const hasResult = resultText != null;
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
          <renderer.ResultComponent args={parsedArgs} result={resultText!} isError={isError} />
        </div>
      )}
    </div>
  );
}
