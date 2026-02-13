import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useConfigStore } from "@/stores/configStore";
import type { CustomProviderConfig, CustomModelConfig } from "@friend/shared";
import { Plus, Trash2 } from "lucide-react";

const DEFAULT_MODEL: CustomModelConfig = {
  id: "",
  name: "",
  reasoning: false,
  contextWindow: 128000,
  maxTokens: 8192,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

export function ProvidersContent() {
  const customProviders = useConfigStore((s) => s.customProviders);
  const { addCustomProvider, removeCustomProvider } = useConfigStore();

  const [editing, setEditing] = useState<CustomProviderConfig | null>(null);

  const handleSave = async (provider: CustomProviderConfig) => {
    await api.addProvider(provider);
    addCustomProvider(provider);
    setEditing(null);
  };

  const handleDelete = async (name: string) => {
    await api.removeProvider(name);
    removeCustomProvider(name);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[560px] mx-auto space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Custom Providers</h2>
            <button
              onClick={() =>
                setEditing({
                  name: "",
                  baseUrl: "",
                  apiKey: "",
                  api: "openai-completions",
                  models: [{ ...DEFAULT_MODEL }],
                })
              }
              className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90"
            >
              <Plus className="w-3 h-3" />
              Add Provider
            </button>
          </div>

          <div className="space-y-3">
            {customProviders.map((p) => (
              <div key={p.name} className="border border-border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.baseUrl} · {p.api || "openai-completions"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.models.length} model{p.models.length !== 1 ? "s" : ""}:{" "}
                      {p.models.map((m) => m.id).join(", ")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing({ ...p, models: p.models.map((m) => ({ ...m })) })}
                      className="px-2 py-1 text-xs hover:bg-accent rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.name)}
                      className="p-1 hover:bg-destructive/20 rounded"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {customProviders.length === 0 && !editing && (
              <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-md">
                No custom providers configured.
                <br />
                Add one to use custom OpenAI-compatible endpoints.
              </div>
            )}

            {editing && (
              <ProviderForm
                provider={editing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: CustomProviderConfig;
  onSave: (p: CustomProviderConfig) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CustomProviderConfig>(provider);

  // Sync form state when provider prop changes (e.g., switching between providers to edit)
  useEffect(() => {
    setForm(provider);
  }, [provider]);

  const updateField = <K extends keyof CustomProviderConfig>(
    key: K,
    value: CustomProviderConfig[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const updateModel = (index: number, updates: Partial<CustomModelConfig>) => {
    setForm((f) => ({
      ...f,
      models: f.models.map((m, i) => (i === index ? { ...m, ...updates } : m)),
    }));
  };

  const addModel = () => {
    setForm((f) => ({ ...f, models: [...f.models, { ...DEFAULT_MODEL }] }));
  };

  const removeModel = (index: number) => {
    setForm((f) => ({ ...f, models: f.models.filter((_, i) => i !== index) }));
  };

  const handleSubmit = () => {
    if (!form.name || !form.baseUrl || form.models.length === 0) return;
    if (form.models.some((m) => !m.id)) return;
    onSave(form);
  };

  return (
    <div className="border border-primary/30 rounded-md p-3 space-y-3 bg-primary/5">
      <div className="text-xs font-medium text-primary">
        {provider.name ? "Edit Provider" : "New Provider"}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Provider Name</label>
          <input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g. my-ollama"
            className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Base URL</label>
          <input
            value={form.baseUrl}
            onChange={(e) => updateField("baseUrl", e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground block mb-0.5">API Key (optional)</label>
        <input
          type="password"
          value={form.apiKey || ""}
          onChange={(e) => updateField("apiKey", e.target.value)}
          placeholder="sk-..."
          className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground block mb-0.5">API Protocol</label>
        <select
          value={form.api || "openai-completions"}
          onChange={(e) => updateField("api", e.target.value)}
          className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="openai-completions">OpenAI Completions</option>
          <option value="anthropic-messages">Anthropic Messages</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] text-muted-foreground font-medium">Models</label>
          <button
            onClick={addModel}
            className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            Add Model
          </button>
        </div>

        <div className="space-y-2">
          {form.models.map((model, i) => (
            <div key={i} className="border border-border rounded p-2 space-y-1.5 bg-background">
              <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-2 gap-1.5">
                  <input
                    value={model.id}
                    onChange={(e) => updateModel(i, { id: e.target.value })}
                    placeholder="Model ID (e.g. gpt-4o)"
                    className="bg-secondary border border-border rounded px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    value={model.name}
                    onChange={(e) => updateModel(i, { name: e.target.value })}
                    placeholder="Display name"
                    className="bg-secondary border border-border rounded px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                {form.models.length > 1 && (
                  <button
                    onClick={() => removeModel(i)}
                    className="p-0.5 hover:bg-destructive/20 rounded"
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[10px] text-muted-foreground">Context Window</label>
                  <input
                    type="number"
                    value={model.contextWindow}
                    onChange={(e) => updateModel(i, { contextWindow: Number(e.target.value) })}
                    className="w-full bg-secondary border border-border rounded px-2 py-0.5 text-[11px] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Max Tokens</label>
                  <input
                    type="number"
                    value={model.maxTokens}
                    onChange={(e) => updateModel(i, { maxTokens: Number(e.target.value) })}
                    className="w-full bg-secondary border border-border rounded px-2 py-0.5 text-[11px] outline-none"
                  />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={model.reasoning}
                      onChange={(e) => updateModel(i, { reasoning: e.target.checked })}
                      className="rounded"
                    />
                    Reasoning
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs hover:bg-accent rounded-md">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!form.name || !form.baseUrl || form.models.some((m) => !m.id)}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 disabled:opacity-50"
        >
          Save Provider
        </button>
      </div>
    </div>
  );
}
