import { useSessionStore } from "@/stores/sessionStore";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelSelector } from "@/components/ModelSelector";

export function StatusBar() {
  const isStreaming = useSessionStore((s) => s.isStreaming);

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-background text-xs text-muted-foreground select-none">
      <div className="flex items-center gap-1.5">
        <Circle
          className={cn(
            "w-2 h-2 fill-current",
            isStreaming ? "text-yellow-500 animate-pulse" : "text-emerald-500",
          )}
        />
        <span>{isStreaming ? "Streaming" : "Connected"}</span>
      </div>

      <ModelSelector />
    </div>
  );
}
