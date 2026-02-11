import { cn } from "@/lib/utils";

interface BashOutputProps {
  output: string;
  isError?: boolean;
}

export function BashOutput({ output, isError }: BashOutputProps) {
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
