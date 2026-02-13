import { useEffect } from "react";
import { useAgentStore } from "@/stores/agentStore";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface AgentSelectorProps {
  value: string | null;
  onChange: (agentId: string | null) => void;
  className?: string;
}

export function AgentSelector({ value, onChange, className }: AgentSelectorProps) {
  const { agents, loadAgents, loading } = useAgentStore();

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  if (loading || agents.length === 0) return null;

  // If only one agent, don't show selector
  if (agents.length === 1) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs text-muted-foreground">Agent</label>
      <div className="grid grid-cols-2 gap-1.5">
        {agents.map((agent) => {
          const isSelected = value === agent.id;
          const emoji = agent.identity?.emoji || "🤖";
          const name = agent.identity?.name || agent.name;

          return (
            <button
              key={agent.id}
              onClick={() => onChange(isSelected ? null : agent.id)}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 rounded-md border text-sm transition-all",
                isSelected
                  ? "bg-accent border-accent text-accent-foreground"
                  : "bg-secondary/50 border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-base">{emoji}</span>
              <span className="flex-1 truncate text-left">{name}</span>
              {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground/70">
        Select which agent personality to use for this session
      </p>
    </div>
  );
}
