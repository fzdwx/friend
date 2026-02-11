import { Brain, Pen, Wrench, Loader, Zap, Cog } from "lucide-react";
import { useSessionStore, type StreamingPhase } from "@/stores/sessionStore";

const phaseConfig: Record<StreamingPhase, { icon: typeof Loader; text: string } | null> = {
    idle: null,
    started: { icon: Zap, text: "Preparing..." },
    thinking: { icon: Brain, text: "Thinking..." },
    generating: { icon: Pen, text: "Generating..." },
    tool_calling: { icon: Wrench, text: "Calling tool..." },
    tool_executing: { icon: Cog, text: "Running tool..." },
};

export function SessionStatus() {
    const phase = useSessionStore((s) => s.streamingPhase);
    const config = phaseConfig[phase];

    if (!config) return null;

    const Icon = config.icon;

    return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-1">
            <Icon className="w-4 h-4 animate-pulse" />
            <span>{config.text}</span>
            <span className="flex gap-0.5">
        <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
      </span>
        </div>
    );
}
