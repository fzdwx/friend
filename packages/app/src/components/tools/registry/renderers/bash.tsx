import { Terminal } from "lucide-react";
import { createElement } from "react";
import { cn } from "@/lib/utils";
import { registerToolRenderer } from "../registry.js";

function BashOutput({ output, isError }: { output: string; isError?: boolean }) {
  return (
    <div className="bg-[var(--color-background)] text-[var(--color-foreground)]">
      <pre
        className={cn(
          "p-3 text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed",
          isError && "text-[var(--color-destructive)]",
        )}
      >
        {output.slice(0, 3000)}
        {output.length > 3000 && "\n... (truncated)"}
      </pre>
    </div>
  );
}

registerToolRenderer("bash", {
  icon: createElement(Terminal, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => `$ ${String(args.command || "").slice(0, 120)}`,
  ResultComponent: ({ result, isError }) =>
    createElement(BashOutput, { output: result, isError }),
});
