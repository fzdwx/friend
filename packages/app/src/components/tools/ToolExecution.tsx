import type { ToolExecution } from "@/stores/toolStore";
import {
  Terminal,
  FileEdit,
  FileText,
  FilePlus,
  Search,
  FolderOpen,
  List,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BashOutput } from "./BashOutput";
import { FileChange } from "./FileChange";
import { FileRead } from "./FileRead";

const TOOL_ICONS: Record<string, React.ReactNode> = {
  bash: <Terminal className="w-3.5 h-3.5" />,
  edit: <FileEdit className="w-3.5 h-3.5" />,
  read: <FileText className="w-3.5 h-3.5" />,
  write: <FilePlus className="w-3.5 h-3.5" />,
  grep: <Search className="w-3.5 h-3.5" />,
  find: <FolderOpen className="w-3.5 h-3.5" />,
  ls: <List className="w-3.5 h-3.5" />,
};

interface ToolExecutionCardProps {
  execution: ToolExecution;
}

export function ToolExecutionCard({ execution }: ToolExecutionCardProps) {
  const icon = TOOL_ICONS[execution.toolName] ?? <Terminal className="w-3.5 h-3.5" />;

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
        {icon}
        <span className="text-xs font-medium flex-1">{execution.toolName}</span>
        {statusIcon}
      </div>

      {/* Args summary */}
      <div className="px-3 py-1 text-[11px] text-muted-foreground border-b border-border/50">
        <ToolArgsSummary toolName={execution.toolName} args={execution.args} />
      </div>

      {/* Result */}
      {execution.result && (
        <div className="max-h-60 overflow-y-auto">
          <ToolResult
            toolName={execution.toolName}
            result={execution.result}
            isError={execution.isError}
            args={execution.args}
          />
        </div>
      )}
    </div>
  );
}

function ToolArgsSummary({ toolName, args }: { toolName: string; args: Record<string, unknown> }) {
  switch (toolName) {
    case "bash":
      return <code className="font-mono">$ {String(args.command || "").slice(0, 120)}</code>;
    case "read":
      return <span>{String(args.path || args.file_path || "")}</span>;
    case "edit":
      return <span>{String(args.path || args.file_path || "")}</span>;
    case "write":
      return <span>{String(args.path || args.file_path || "")}</span>;
    case "grep":
      return (
        <span>
          /{String(args.pattern || "")}/ in {String(args.path || ".")}
        </span>
      );
    case "find":
      return <span>{String(args.glob || args.path || "")}</span>;
    default:
      return <span>{JSON.stringify(args).slice(0, 100)}</span>;
  }
}

function ToolResult({
  toolName,
  result,
  isError,
  args,
}: {
  toolName: string;
  result: string;
  isError?: boolean;
  args: Record<string, unknown>;
}) {
  if (toolName === "bash") {
    return <BashOutput output={result} isError={isError} />;
  }
  if (toolName === "edit") {
    return <FileChange filePath={String(args.path || args.file_path || "")} result={result} />;
  }
  if (toolName === "read") {
    return <FileRead filePath={String(args.path || args.file_path || "")} content={result} />;
  }

  // Generic result
  return (
    <pre
      className={cn(
        "p-2 text-[11px] font-mono whitespace-pre-wrap break-all",
        isError ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {result.slice(0, 2000)}
      {result.length > 2000 && "\n... (truncated)"}
    </pre>
  );
}
