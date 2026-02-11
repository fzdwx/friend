import { useState } from "react";
import { api } from "@/lib/api";
import { Settings, X } from "lucide-react";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google" },
  { id: "mistral", label: "Mistral" },
];

export function ApiKeySettings() {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const handleSave = async (provider: string) => {
    const key = keys[provider];
    if (!key) return;
    await api.setAuth(provider, key);
    setSaved((s) => ({ ...s, [provider]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [provider]: false })), 2000);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md hover:bg-accent transition-colors"
        title="Settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-card border border-border rounded-lg shadow-xl z-50 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">API Key Settings</h2>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <div key={p.id}>
              <label className="text-xs text-muted-foreground mb-1 block">{p.label} API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keys[p.id] || ""}
                  onChange={(e) => setKeys((k) => ({ ...k, [p.id]: e.target.value }))}
                  placeholder={`sk-...`}
                  className="flex-1 bg-secondary border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={() => handleSave(p.id)}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 transition-colors"
                >
                  {saved[p.id] ? "Saved!" : "Save"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
