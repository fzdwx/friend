import { Terminal, FileEdit, FileText, Search, FolderOpen, List, FilePlus } from "lucide-react";

const TOOL_ICONS: Record<string, React.ReactNode> = {
  bash: <Terminal className="w-3 h-3" />,
  edit: <FileEdit className="w-3 h-3" />,
  read: <FileText className="w-3 h-3" />,
  write: <FilePlus className="w-3 h-3" />,
  grep: <Search className="w-3 h-3" />,
  find: <FolderOpen className="w-3 h-3" />,
  ls: <List className="w-3 h-3" />,
};

interface ToolCallBlockProps {
  toolCallId: string;
  toolName: string;
  args: string;
}

export function ToolCallBlock({ toolName, args }: ToolCallBlockProps) {
  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = JSON.parse(args);
  } catch {}

  const summary = getToolSummary(toolName, parsedArgs);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 text-xs text-muted-foreground border border-border/50">
      {TOOL_ICONS[toolName] ?? <Terminal className="w-3 h-3" />}
      <span className="font-medium">{toolName}</span>
      {summary && <span className="truncate">{summary}</span>}
    </div>
  );
}

function getToolSummary(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "read":
      return String(args.path || args.file_path || "");
    case "edit":
      return String(args.path || args.file_path || "");
    case "write":
      return String(args.path || args.file_path || "");
    case "bash":
      return String(args.command || "").slice(0, 80);
    case "grep":
      return `${args.pattern || ""} ${args.path || ""}`;
    case "find":
      return String(args.path || args.glob || "");
    case "ls":
      return String(args.path || ".");
    default:
      return "";
  }
}
