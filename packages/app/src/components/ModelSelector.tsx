import { useEffect, useMemo } from "react";
import { Cpu } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore.js";
import type { ModelInfo } from "@friend/shared";

export function ModelSelector() {
  const availableModels = useSessionStore((s) => s.availableModels);
  const currentModel = useSessionStore((s) => s.currentModel);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const loadModels = useSessionStore((s) => s.loadModels);
  const setCurrentModel = useSessionStore((s) => s.setCurrentModel);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const groupedModels = useMemo(() => {
    const groups = new Map<string, ModelInfo[]>();
    const availableModelsOnly = availableModels.filter((m) => m.available !== false);

    for (const model of availableModelsOnly) {
      const existing = groups.get(model.provider) || [];
      existing.push(model);
      groups.set(model.provider, existing);
    }

    const currentIsVisible =
      currentModel &&
      availableModelsOnly.some(
        (m) => m.provider === currentModel.provider && m.id === currentModel.id,
      );

    if (currentModel && !currentIsVisible) {
      const existing = groups.get(currentModel.provider) || [];
      existing.push(currentModel);
      groups.set(currentModel.provider, existing);
    }

    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [availableModels, currentModel]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value || !activeSessionId) return;

    const [provider, modelId] = value.split("/");
    if (provider && modelId) {
      setCurrentModel(activeSessionId, provider, modelId);
    }
  };

  const currentValue = currentModel ? `${currentModel.provider}/${currentModel.id}` : "";

  return (
    <div className="flex items-center gap-2">
      <Cpu className="w-3 h-3 text-muted-foreground" />
      <select
        value={currentValue}
        onChange={handleChange}
        disabled={!activeSessionId || availableModels.length === 0}
        className="bg-secondary border border-border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {availableModels.length === 0 ? (
          <option value="">No models available</option>
        ) : (
          <>
            <option value="">Select model...</option>
            {[...groupedModels.entries()].map(([provider, models]) => (
              <optgroup key={provider} label={provider}>
                {models.map((model) => (
                  <option
                    key={`${model.provider}/${model.id}`}
                    value={`${model.provider}/${model.id}`}
                  >
                    {model.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
