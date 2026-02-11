import { useState } from "react";
import { Plus, Download, Upload, Trash2, Eye, Edit3 } from "lucide-react";
import { useConfigStore } from "@/stores/configStore";
import { applyThemeToDOM, cloneColorSet, generateId, oklchToHex, hexToOklch } from "@/lib/theme";
import type { ThemeConfig, ColorSet, ColorDefinition } from "@friend/shared";
import { PresetCard } from "./PresetCard";
import { ColorPicker } from "./ColorPicker";
import { cn } from "@/lib/utils";

const COLOR_KEYS: Array<keyof ColorSet> = [
  "background",
  "foreground",
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructive",
  "destructiveForeground",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebarForeground",
  "sidebarBorder",
];

const COLOR_LABELS: Record<keyof ColorSet, string> = {
  background: "Background",
  foreground: "Foreground",
  card: "Card",
  cardForeground: "Card Foreground",
  popover: "Popover",
  popoverForeground: "Popover Foreground",
  primary: "Primary",
  primaryForeground: "Primary Foreground",
  secondary: "Secondary",
  secondaryForeground: "Secondary Foreground",
  muted: "Muted",
  mutedForeground: "Muted Foreground",
  accent: "Accent",
  accentForeground: "Accent Foreground",
  destructive: "Destructive",
  destructiveForeground: "Destructive Foreground",
  border: "Border",
  input: "Input",
  ring: "Ring",
  sidebar: "Sidebar",
  sidebarForeground: "Sidebar Foreground",
  sidebarBorder: "Sidebar Border",
};

type Tab = "presets" | "custom";

export function AppearanceContent() {
  const activeThemeId = useConfigStore((s) => s.activeThemeId);
  const getAllThemes = useConfigStore((s) => s.getAllThemes);
  const setActiveThemeId = useConfigStore((s) => s.setActiveThemeId);
  const addCustomTheme = useConfigStore((s) => s.addCustomTheme);
  const updateCustomTheme = useConfigStore((s) => s.updateCustomTheme);
  const deleteCustomTheme = useConfigStore((s) => s.deleteCustomTheme);

  const [tab, setTab] = useState<Tab>("presets");
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editingColors, setEditingColors] = useState<ColorSet | null>(null);

  const themes = getAllThemes();
  const activeTheme = themes.find((t) => t.id === activeThemeId);
  const customThemes = themes.filter((t) => !t.isBuiltIn);

  const handleSelectTheme = (themeId: string) => {
    setActiveThemeId(themeId);
  };

  const handleCreateCustomTheme = () => {
    if (!activeTheme) return;

    const newTheme: ThemeConfig = {
      id: generateId(),
      name: `Custom ${customThemes.length + 1}`,
      mode: activeTheme.mode,
      colors: cloneColorSet(activeTheme.colors),
      isPreset: false,
      isBuiltIn: false,
    };

    addCustomTheme(newTheme);
    setActiveThemeId(newTheme.id);
  };

  const handleEditTheme = (themeId: string) => {
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) return;

    setEditingThemeId(themeId);
    setEditingColors(cloneColorSet(theme.colors));
    setTab("custom");
  };

  const handleSaveCustomTheme = () => {
    if (!editingThemeId || !editingColors) return;

    updateCustomTheme(editingThemeId, { colors: editingColors });
    setEditingThemeId(null);
    setEditingColors(null);
  };

  const handleCancelEdit = () => {
    setEditingThemeId(null);
    setEditingColors(null);
  };

  const handleColorChange = (key: keyof ColorSet, color: ColorDefinition) => {
    if (!editingColors) return;
    setEditingColors({ ...editingColors, [key]: color });
  };

  const handleDeleteTheme = (themeId: string) => {
    deleteCustomTheme(themeId);
    if (editingThemeId === themeId) {
      handleCancelEdit();
    }
  };

  const handleExportTheme = (theme: ThemeConfig) => {
    const dataStr = JSON.stringify(theme, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${theme.name.replace(/\s+/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as ThemeConfig;
        const newTheme: ThemeConfig = {
          ...imported,
          id: generateId(),
          name: `${imported.name} (imported)`,
          isPreset: false,
          isBuiltIn: false,
        };
        addCustomTheme(newTheme);
        setActiveThemeId(newTheme.id);
      } catch (error) {
        console.error("Failed to import theme:", error);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (editingColors && editingThemeId) {
    const editingTheme = themes.find((t) => t.id === editingThemeId);

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">编辑主题</h2>
            <p className="text-sm text-[var(--color-muted-foreground)]">{editingTheme?.name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveCustomTheme}
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 transition-opacity"
            >
              保存
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COLOR_KEYS.map((key) => (
            <ColorPicker
              key={key}
              label={COLOR_LABELS[key]}
              value={editingColors[key]}
              onChange={(color) => handleColorChange(key, color)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]">外观</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">自定义主题颜色和外观风格</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".json" className="hidden" onChange={handleImportTheme} />
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors">
              <Upload className="w-4 h-4" />
              导入
            </div>
          </label>
          {activeTheme && !activeTheme.isBuiltIn && (
            <button
              onClick={() => handleExportTheme(activeTheme)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
          )}
          <button
            onClick={handleCreateCustomTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            新建
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-muted)]">
        <button
          onClick={() => setTab("presets")}
          className={cn(
            "flex-1 px-3 py-1.5 text-sm rounded-md transition-all",
            tab === "presets"
              ? "bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
          )}
        >
          预设主题
        </button>
        <button
          onClick={() => setTab("custom")}
          className={cn(
            "flex-1 px-3 py-1.5 text-sm rounded-md transition-all",
            tab === "custom"
              ? "bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
          )}
        >
          自定义主题 ({customThemes.length})
        </button>
      </div>

      {tab === "presets" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {themes.map((theme) => (
            <div key={theme.id} className="relative group">
              <PresetCard
                theme={theme}
                isSelected={activeThemeId === theme.id}
                onClick={() => handleSelectTheme(theme.id)}
              />
              {!theme.isBuiltIn && (
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTheme(theme.id);
                    }}
                    className="p-1.5 rounded bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)] shadow-sm"
                    title="编辑"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTheme(theme.id);
                    }}
                    className="p-1.5 rounded bg-[var(--color-destructive)]/10 border border-[var(--color-destructive)]/20 text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/20 shadow-sm"
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "custom" && (
        <div>
          {customThemes.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-muted-foreground)]">
              <p className="mb-4">还没有自定义主题</p>
              <button
                onClick={handleCreateCustomTheme}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                创建第一个自定义主题
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {customThemes.map((theme) => (
                <div key={theme.id} className="relative group">
                  <PresetCard
                    theme={theme}
                    isSelected={activeThemeId === theme.id}
                    onClick={() => handleSelectTheme(theme.id)}
                  />
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTheme(theme.id);
                      }}
                      className="p-1.5 rounded bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)] shadow-sm"
                      title="编辑"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTheme(theme.id);
                      }}
                      className="p-1.5 rounded bg-[var(--color-destructive)]/10 border border-[var(--color-destructive)]/20 text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/20 shadow-sm"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
