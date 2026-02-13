import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Info } from "lucide-react";

interface EmbeddingConfig {
  provider: "openai" | "gemini" | "voyage" | "auto";
  model?: string;
}

const PROVIDER_OPTIONS = [
  { value: "auto", label: "Auto (use first available)", description: "Automatically select the best available provider" },
  { value: "openai", label: "OpenAI", description: "text-embedding-3-small (default)" },
  { value: "gemini", label: "Google Gemini", description: "gemini-embedding-001" },
  { value: "voyage", label: "Voyage AI", description: "voyage-4-large" },
];

export function MemoryContent() {
  const [config, setConfig] = useState<EmbeddingConfig>({ provider: "auto" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const res = await api.getEmbeddingConfig();
    if (res.ok && res.data) {
      setConfig({
        provider: res.data.provider as EmbeddingConfig["provider"],
        model: res.data.model,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await api.setEmbeddingConfig({
      provider: config.provider,
      model: config.model,
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Memory Search</h2>
        <p className="text-xs text-muted-foreground">
          Configure embedding provider for semantic memory search. 
          Without embedding, memory search uses BM25 keyword matching.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-muted/50 border border-border rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>BM25 (default)</strong>: Works out of the box with keyword matching. 
            No configuration needed.
          </p>
          <p>
            <strong>Vector Search</strong>: Requires an embedding API key. 
            Provides semantic understanding and better relevance.
          </p>
        </div>
      </div>

      {/* Provider Selection */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-2">
          Embedding Provider
        </label>
        <div className="space-y-2">
          {PROVIDER_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                config.provider === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <input
                type="radio"
                name="embedding-provider"
                value={option.value}
                checked={config.provider === option.value}
                onChange={() => setConfig({ ...config, provider: option.value as EmbeddingConfig["provider"] })}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Model Override (optional) */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Model Override (optional)
        </label>
        <input
          type="text"
          value={config.model || ""}
          onChange={(e) => setConfig({ ...config, model: e.target.value || undefined })}
          placeholder="e.g. text-embedding-3-large"
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Leave empty to use the default model for the selected provider.
        </p>
      </div>

      {/* API Key Info */}
      <div className="bg-secondary/50 border border-border rounded-md p-3">
        <h3 className="text-xs font-medium mb-2">API Keys</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Embedding API keys are read from your OAuth login or environment variables:
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>OpenAI</strong>: OAuth login or <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code></li>
          <li><strong>Gemini</strong>: <code className="bg-muted px-1 rounded">GEMINI_API_KEY</code></li>
          <li><strong>Voyage</strong>: <code className="bg-muted px-1 rounded">VOYAGE_API_KEY</code></li>
        </ul>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}
