import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Bot,
  Save,
  X,
  AlertCircle,
  FileText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/stores/sessionStore.js";
import type { ModelInfo } from "@friend/shared";

interface Subagent {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  source: "user" | "workspace";
  filePath: string;
}

interface SubagentFormData {
  name: string;
  description: string;
  tools: string[];
  model: string;
  systemPrompt: string;
}

// 完整的工具列表
// SDK 提供 7 个核心工具，自定义工具 5 个
const AVAILABLE_TOOLS = [
  // SDK 核心工具 (createCodingTools 返回 4 个: read, bash, edit, write)
  // SDK 额外工具 (需单独创建: grep, find, ls)
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
  // 自定义工具
  "glob",
  "get_session",
  "memory_search",
  "memory_get",
  "question",
];

export function SubagentsContent() {
  const { t } = useTranslation();
  const [subagents, setSubagents] = useState<Subagent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSubagent, setEditingSubagent] = useState<Subagent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<SubagentFormData>({
    name: "",
    description: "",
    tools: [],
    model: "",
    systemPrompt: "",
  });
  const [saving, setSaving] = useState(false);

  // 使用 sessionStore 获取模型列表（复用 ModelSelector 的数据源）
  const availableModels = useSessionStore((s) => s.availableModels);
  const loadModels = useSessionStore((s) => s.loadModels);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // 将模型按 provider 分组（复用 ModelSelector 的逻辑）
  const groupedModels = (() => {
    const groups = new Map<string, ModelInfo[]>();
    const availableModelsOnly = availableModels.filter((m) => m.available !== false);

    for (const model of availableModelsOnly) {
      const existing = groups.get(model.provider) || [];
      existing.push(model);
      groups.set(model.provider, existing);
    }

    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  })();

  const loadSubagents = async () => {
    try {
      setError(null);
      setLoading(true);
      const res = await api.listSubagents();
      if (res.ok && res.data) {
        setSubagents(res.data);
      } else {
        setError(res.error || "Failed to load subagents");
      }
    } catch (err) {
      setError("Failed to load subagents");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubagents();
  }, []);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingSubagent(null);
    setFormData({
      name: "",
      description: "",
      tools: [],
      model: "",
      systemPrompt: "",
    });
  };

  const handleEdit = (subagent: Subagent) => {
    setEditingSubagent(subagent);
    setIsCreating(false);
    setFormData({
      name: subagent.name,
      description: subagent.description,
      tools: subagent.tools || [],
      model: subagent.model || "",
      systemPrompt: subagent.systemPrompt,
    });
  };

  const handleCancel = () => {
    setEditingSubagent(null);
    setIsCreating(false);
    setFormData({
      name: "",
      description: "",
      tools: [],
      model: "",
      systemPrompt: "",
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description || !formData.systemPrompt) {
      setError("Name, description, and system prompt are required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isCreating) {
        const res = await api.createSubagent(formData);
        if (res.ok) {
          await loadSubagents();
          handleCancel();
        } else {
          setError(res.error || "Failed to create subagent");
        }
      } else if (editingSubagent) {
        const res = await api.updateSubagent(editingSubagent.name, {
          description: formData.description,
          tools: formData.tools.length > 0 ? formData.tools : undefined,
          model: formData.model || undefined,
          systemPrompt: formData.systemPrompt,
        });
        if (res.ok) {
          await loadSubagents();
          handleCancel();
        } else {
          setError(res.error || "Failed to update subagent");
        }
      }
    } catch (err) {
      setError("Failed to save subagent");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete subagent "${name}"?`)) {
      return;
    }

    try {
      setError(null);
      const res = await api.deleteSubagent(name);
      if (res.ok) {
        await loadSubagents();
      } else {
        setError(res.error || "Failed to delete subagent");
      }
    } catch (err) {
      setError("Failed to delete subagent");
      console.error(err);
    }
  };

  const toggleTool = (tool: string) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter(t => t !== tool)
        : [...prev.tools, tool],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("subagents.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subagents.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSubagents}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            {t("common.refresh")}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("subagents.create")}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-500/10 rounded-md">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingSubagent) && (
        <div className="border border-border rounded-lg p-4 space-y-4 bg-card">
          <h3 className="font-medium">
            {isCreating ? t("subagents.createNew") : t("subagents.edit")}: {formData.name}
          </h3>

          <div className="grid gap-4">
            {/* Name */}
            {isCreating && (
              <div>
                <label className="text-sm font-medium">{t("subagents.form.name")}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                  placeholder="my-agent"
                />
              </div>
            )}

            {/* Description */}
            <div>
              <label className="text-sm font-medium">{t("subagents.form.description")}</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                placeholder="What does this agent do?"
              />
            </div>

            {/* Model */}
            <div>
              <label className="text-sm font-medium">{t("subagents.form.model")}</label>
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
              >
                <option value="">{t("subagents.form.defaultModel")}</option>
                {[...groupedModels.entries()].map(([provider, models]) => (
                  <optgroup key={provider} label={provider}>
                    {models.map((model) => (
                      <option key={`${model.provider}/${model.id}`} value={`${model.provider}/${model.id}`}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Tools */}
            <div>
              <label className="text-sm font-medium">{t("subagents.form.tools")}</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                {t("subagents.form.toolsHint")}
              </p>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tools: [...AVAILABLE_TOOLS] })}
                  className="px-3 py-1 text-xs border border-input rounded-md hover:bg-accent transition-colors"
                >
                  {t("subagents.form.selectAll")}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tools: [] })}
                  className="px-3 py-1 text-xs border border-input rounded-md hover:bg-accent transition-colors"
                >
                  {t("subagents.form.clearAll")}
                </button>
                <span className="text-xs text-muted-foreground ml-2">
                  {formData.tools.length} / {AVAILABLE_TOOLS.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                {AVAILABLE_TOOLS.map((tool) => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleTool(tool)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-md border transition-colors",
                      formData.tools.includes(tool)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-input hover:bg-accent",
                    )}
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <label className="text-sm font-medium">{t("subagents.form.systemPrompt")}</label>
              <textarea
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background font-mono"
                rows={8}
                placeholder="You are a specialized agent..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}

      {/* Subagents List */}
      <div className="space-y-3">
        {subagents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t("subagents.empty")}</p>
            <p className="text-xs mt-1">{t("subagents.emptyHint")}</p>
          </div>
        ) : (
          subagents.map((subagent) => (
            <div
              key={subagent.name}
              className="border border-border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-4 h-4 text-primary" />
                    <h3 className="font-medium">{subagent.name}</h3>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        subagent.source === "user"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-purple-500/10 text-purple-500",
                      )}
                    >
                      {subagent.source}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {subagent.description}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {subagent.tools && (
                      <div className="flex items-center gap-1">
                        <Settings className="w-3 h-3" />
                        <span>{subagent.tools.join(", ")}</span>
                      </div>
                    )}
                    {subagent.model && (
                      <div className="flex items-center gap-1">
                        <span>•</span>
                        <span>{subagent.model}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => handleEdit(subagent)}
                    className="p-1.5 rounded hover:bg-accent transition-colors"
                    title={t("common.edit")}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subagent.name)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-500 hover:text-red-600 transition-colors"
                    title={t("common.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Help */}
      <div className="border border-border rounded-lg p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{t("subagents.helpTitle")}</p>
            <p>{t("subagents.helpText")}</p>
            <code className="block px-2 py-1 bg-background rounded text-xs mt-2">
              ~/.config/friend/subagents/*.md
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
