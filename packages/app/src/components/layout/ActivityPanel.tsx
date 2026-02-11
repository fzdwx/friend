import { useToolStore, type ToolExecution } from "@/stores/toolStore";
import { ToolExecutionCard } from "@/components/tools/ToolExecution";
import { Activity } from "lucide-react";

export function ActivityPanel() {
  const executions = useToolStore((s) => s.executions);

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="w-4 h-4" />
          Activity
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {executions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            Tool executions will appear here
          </div>
        ) : (
          executions.map((exec) => <ToolExecutionCard key={exec.toolCallId} execution={exec} />)
        )}
      </div>
    </div>
  );
}
