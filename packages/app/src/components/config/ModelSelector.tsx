import { useState } from "react";
import { api } from "@/lib/api";
import { useConfigStore } from "@/stores/configStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { ModelInfo } from "@friend/shared";
import { ChevronDown, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const models = useConfigStore((s) => s.models);
  const currentModel = useSessionStore((s) => s.currentModel);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  const handleSelect = async (model: ModelInfo) => {
    if (!activeSessionId) return;
    await api.setModel(activeSessionId, model.provider, model.id);
    useSessionStore.getState().setModel(`${model.provider}/${model.id}`);
    setOpen(false);
  };

  // Group models by provider
  const grouped = models.reduce<Record<string, ModelInfo[]>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-accent transition-colors"
      >
        <span className="truncate max-w-[200px]">{currentModel || "Select model"}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-72 bg-popover border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
            {Object.entries(grouped).map(([provider, providerModels]) => (
              <div key={provider}>
                <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wider bg-secondary/30 sticky top-0">
                  {provider}
                </div>
                {providerModels.map((m) => (
                  <button
                    key={`${m.provider}/${m.id}`}
                    onClick={() => handleSelect(m)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2",
                      !m.available && "opacity-50",
                    )}
                    disabled={!m.available}
                  >
                    <Circle
                      className={cn(
                        "w-1.5 h-1.5 flex-shrink-0",
                        m.available ? "fill-emerald-500 text-emerald-500" : "fill-muted text-muted",
                      )}
                    />
                    <span className="truncate">{m.id}</span>
                    {!m.available && (
                      <span className="ml-auto text-[10px] text-muted-foreground">no key</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
            {models.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                No models found. Set an API key or add a custom provider.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
