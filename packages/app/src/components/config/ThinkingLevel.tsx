import { useState } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { api } from "@/lib/api";
import type { ThinkingLevel } from "@friend/shared";
import { ChevronDown } from "lucide-react";

const LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];

export function ThinkingLevelSelector() {
  const [open, setOpen] = useState(false);
  const thinkingLevel = useSessionStore((s) => s.thinkingLevel);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  const handleSelect = async (level: ThinkingLevel) => {
    if (!activeSessionId) return;
    await api.setThinking(activeSessionId, level);
    useSessionStore.getState().setThinkingLevel(level);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-accent transition-colors"
      >
        Thinking: {thinkingLevel}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-36 bg-popover border border-border rounded-md shadow-lg z-50">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => handleSelect(level)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors"
              >
                {level}
                {level === thinkingLevel && " *"}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
