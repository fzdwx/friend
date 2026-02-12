import type { ToolExecution } from "@/stores/toolStore";
import { Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToolRenderer } from "./registry/registry.js";

interface ToolExecutionCardProps {
  execution: ToolExecution;
}

export function ToolExecutionCard({ execution }: ToolExecutionCardProps) {
  const renderer = getToolRenderer(execution.toolName);

  const statusIcon =
    execution.status === "running" ? (
      <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
    ) : execution.isError ? (
      <X className="w-3 h-3 text-destructive" />
    ) : (
      <Check className="w-3 h-3 text-emerald-500" />
    );

  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30">
        {renderer.icon}
        <span className="text-xs font-medium flex-1">{execution.toolName}</span>
        {statusIcon}
      </div>

      {/* Args summary */}
      <div className="px-3 py-1 text-[11px] text-muted-foreground border-b border-border/50">
        {renderer.getSummary(execution.args)}
      </div>

      {/* Result */}
      {execution.result && (
        <div className="max-h-60 overflow-y-auto">
          {renderer.ResultComponent ? (
            <renderer.ResultComponent
              args={execution.args}
              result={execution.result}
              isError={execution.isError ?? false}
            />
          ) : (
            <pre
              className={cn(
                "p-2 text-[11px] font-mono whitespace-pre-wrap break-all",
                execution.isError ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {execution.result.slice(0, 2000)}
              {execution.result.length > 2000 && "\n... (truncated)"}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
