import { useSessionStore } from "@/stores/sessionStore";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const isStreaming = useSessionStore((s) => s.isStreaming);

  return (
    <div
      className={cn(
        "fixed bottom-3 right-3 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full",
        "bg-background/90 backdrop-blur-sm border border-border/50",
        "text-xs text-muted-foreground select-none shadow-sm",
        "transition-all duration-200 hover:shadow-md",
        isStreaming && "animate-pulse"
      )}
      title={isStreaming ? "AI is streaming a response" : "Connected to server"}
    >
      <Circle
        className={cn(
          "w-2 h-2 fill-current",
          isStreaming ? "text-yellow-500" : "text-emerald-500",
        )}
      />
      <span className="font-medium">{isStreaming ? "Streaming" : "Connected"}</span>
    </div>
  );
}
