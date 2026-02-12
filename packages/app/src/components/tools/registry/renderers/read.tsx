import { FileText } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";

function FileRead({ filePath, content }: { filePath: string; content: string }) {
  const lines = content.split("\n");
  const lineCount = lines.length;

  return (
    <div className="text-[11px] font-mono">
      <div className="px-3 py-1 bg-secondary/50 text-muted-foreground border-b border-border/50 flex justify-between">
        <span>{filePath}</span>
        <span>{lineCount} lines</span>
      </div>
      <pre className="p-3 whitespace-pre-wrap break-all leading-relaxed text-muted-foreground max-h-48 overflow-y-auto">
        {content.slice(0, 3000)}
        {content.length > 3000 && "\n... (truncated)"}
      </pre>
    </div>
  );
}

registerToolRenderer("read", {
  icon: createElement(FileText, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => String(args.path || args.file_path || ""),
  ResultComponent: ({ args, result }) =>
    createElement(FileRead, {
      filePath: String(args.path || args.file_path || ""),
      content: result,
    }),
});
