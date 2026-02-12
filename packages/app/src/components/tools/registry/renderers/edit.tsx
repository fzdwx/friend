import { FileEdit } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";

function FileChange({ filePath, result }: { filePath: string; result: string }) {
  const lines = result.split("\n");

  return (
    <div className="text-[11px] font-mono">
      <div className="px-3 py-1 bg-secondary/50 text-muted-foreground border-b border-border/50">
        {filePath}
      </div>
      <pre className="p-3 whitespace-pre-wrap break-all leading-relaxed">
        {lines.map((line, i) => {
          let className = "text-muted-foreground";
          if (line.startsWith("+") && !line.startsWith("+++")) {
            className = "text-emerald-400 bg-emerald-400/10";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            className = "text-red-400 bg-red-400/10";
          } else if (line.startsWith("@@")) {
            className = "text-blue-400";
          }
          return (
            <div key={i} className={className}>
              {line}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

registerToolRenderer("edit", {
  icon: createElement(FileEdit, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => String(args.path || args.file_path || ""),
  ResultComponent: ({ args, result }) =>
    createElement(FileChange, {
      filePath: String(args.path || args.file_path || ""),
      result,
    }),
});
