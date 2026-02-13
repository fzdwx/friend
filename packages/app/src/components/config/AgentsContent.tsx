import { useEffect, useState } from "react";
import { useAgentStore, type AgentInfo } from "@/stores/agentStore";
import { api } from "@/lib/api";
import type { ModelInfo } from "@friend/shared";
import { cn } from "@/lib/utils";
import {
  Bot,
  Plus,
  Trash2,
  Edit3,
  Check,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";

type EditMode = "none" | "create" | "edit";

export function AgentsContent() {
  const { t } = useTranslation();
  const {
    agents,
    loading,
    loadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
  } = useAgentStore();

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [editingAgent, setEditingAgent] = useState<Partial<AgentInfo>>({});
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
    loadModels();
  }, [loadAgents]);

  const loadModels = async () => {
    const res = await api.getModels();
    if (res.ok && res.data) {
      setModels(res.data);
    }
  };

  const handleCreate = () => {
    setEditMode("create");
    setEditingAgent({
      id: "",
      name: "",
      identity: { name: "", emoji: "🤖", vibe: "" },
    });
  };

  const handleEdit = (agent: AgentInfo) => {
    setEditMode("edit");
    setEditingAgent({ ...agent });
  };

  const handleSave = async () => {
    if (!editingAgent.name && !editingAgent.identity?.name) return;

    if (editMode === "create") {
      const result = await createAgent(editingAgent);
      if (result.error) {
        alert(result.error);
        return;
      }
    } else if (editMode === "edit" && editingAgent.id) {
      const result = await updateAgent(editingAgent.id, editingAgent);
      if (result.error) {
        alert(result.error);
        return;
      }
    }

    setEditMode("none");
    setEditingAgent({});
  };

  const handleCancel = () => {
    setEditMode("none");
    setEditingAgent({});
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this agent? This cannot be undone.")) {
      const result = await deleteAgent(id);
      if (result.error) {
        alert(result.error);
      }
    }
  };

  // Group models by provider
  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("agents.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("agents.subtitle")}
          </p>
        </div>
        {editMode === "none" && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t("agents.newAgent")}</span>
          </button>
        )}
      </div>

      {/* Agent List */}
      <div className="space-y-3">
        {agents.map((agent) => {
          const isExpanded = expandedAgent === agent.id;
          const isEditing = editMode === "edit" && editingAgent.id === agent.id;
          const emoji = agent.identity?.emoji || "🤖";
          const name = agent.identity?.name || agent.name;

          return (
            <div
              key={agent.id}
              className="border border-border rounded-lg overflow-hidden"
            >
              {/* Agent Header */}
              <div
                className="flex items-center gap-3 p-4 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
              >
                <button className="text-muted-foreground">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                <span className="text-2xl">{emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{name}</span>
                    {agent.isDefault && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground">
                        {t("agents.default")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("agents.id")}: {agent.id}
                    {agent.model && ` • ${agent.model}`}
                  </div>
                </div>
                {!isEditing && (
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(agent);
                      }}
                      className="p-1.5 rounded hover:bg-accent/50 transition-colors"
                      title={t("common.edit")}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {!agent.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(agent.id);
                        }}
                        className="p-1.5 rounded hover:bg-destructive/20 transition-colors text-destructive"
                        title={t("common.delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-border p-4 space-y-4">
                  {isEditing ? (
                    <EditAgentForm
                      agent={editingAgent}
                      onChange={setEditingAgent}
                      onSave={handleSave}
                      onCancel={handleCancel}
                      modelsByProvider={modelsByProvider}
                      t={t}
                    />
                  ) : (
                    <>
                      {/* Agent Details */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted-foreground uppercase tracking-wide">
                            {t("agents.vibe")}
                          </label>
                          <p className="text-sm mt-1">
                            {agent.identity?.vibe || t("agents.noVibe")}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground uppercase tracking-wide">
                            {t("agents.thinkingLevel")}
                          </label>
                          <p className="text-sm mt-1">
                            {agent.thinkingLevel || "default"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wide">
                          {t("agents.defaultModel")}
                        </label>
                        <p className="text-sm mt-1 font-mono">
                          {agent.model || t("agents.notSet")}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Create Form */}
        {editMode === "create" && (
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-medium mb-4">{t("agents.createNewAgent")}</h3>
            <EditAgentForm
              agent={editingAgent}
              onChange={setEditingAgent}
              onSave={handleSave}
              onCancel={handleCancel}
              isNew
              modelsByProvider={modelsByProvider}
              t={t}
            />
          </div>
        )}

        {agents.length === 0 && editMode === "none" && (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t("agents.noAgents")}</p>
            <button
              onClick={handleCreate}
              className="mt-2 text-accent hover:underline"
            >
              {t("agents.createFirst")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Agent Form ───────────────────────────────────────────────

interface EditFormProps {
  agent: Partial<AgentInfo>;
  onChange: (agent: Partial<AgentInfo>) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
  modelsByProvider: Record<string, ModelInfo[]>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function EditAgentForm({ agent, onChange, onSave, onCancel, isNew, modelsByProvider, t }: EditFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {isNew && (
          <div>
            <label className="text-xs text-muted-foreground">{t("agents.id")}</label>
            <input
              type="text"
              value={agent.id || ""}
              onChange={(e) => onChange({ ...agent, id: e.target.value })}
              placeholder="my-agent"
              className="w-full mt-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">{t("agents.displayName")}</label>
          <input
            type="text"
            value={agent.identity?.name || agent.name || ""}
            onChange={(e) =>
              onChange({
                ...agent,
                name: e.target.value,
                identity: { ...agent.identity, name: e.target.value },
              })
            }
            placeholder={t("agents.displayNamePlaceholder")}
            className="w-full mt-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("agents.emoji")}</label>
          <input
            type="text"
            value={agent.identity?.emoji || "🤖"}
            onChange={(e) =>
              onChange({ ...agent, identity: { ...agent.identity, emoji: e.target.value } })
            }
            className="w-full mt-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">{t("agents.personality")}</label>
        <textarea
          value={agent.identity?.vibe || ""}
          onChange={(e) =>
            onChange({ ...agent, identity: { ...agent.identity, vibe: e.target.value } })
          }
          placeholder={t("agents.personalityPlaceholder")}
          rows={2}
          className="w-full mt-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">{t("agents.defaultModel")}</label>
          <select
            value={agent.model || ""}
            onChange={(e) => onChange({ ...agent, model: e.target.value || undefined })}
            className="w-full mt-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">{t("agents.useSystemDefault")}</option>
            {Object.entries(modelsByProvider).map(([provider, models]) => (
              <optgroup key={provider} label={provider}>
                {models.map((model) => (
                  <option key={model.id} value={`${provider}/${model.id}`}>
                    {model.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("agents.thinkingLevel")}</label>
          <select
            value={agent.thinkingLevel || "medium"}
            onChange={(e) => onChange({ ...agent, thinkingLevel: e.target.value })}
            className="w-full mt-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="off">{t("agents.thinkingLevelOff")}</option>
            <option value="minimal">{t("agents.thinkingLevelMinimal")}</option>
            <option value="low">{t("agents.thinkingLevelLow")}</option>
            <option value="medium">{t("agents.thinkingLevelMedium")}</option>
            <option value="high">{t("agents.thinkingLevelHigh")}</option>
            <option value="xhigh">XHigh</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/80 transition-colors"
        >
          <Check className="w-4 h-4" />
          <span>{isNew ? t("common.create") : t("common.save")}</span>
        </button>
      </div>
    </div>
  );
}
