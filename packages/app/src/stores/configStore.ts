import { create } from "zustand";
import type { AppConfig, CustomProviderConfig, ThemeConfig } from "@friend/shared";
import { BUILT_IN_THEMES } from "@/lib/themePresets";
import { generateId, applyThemeToDOM, removeThemeFromDOM } from "@/lib/theme";

const ACTIVE_THEME_STORAGE_KEY = "friend-active-theme-id";
const CUSTOM_THEMES_STORAGE_KEY = "friend-custom-themes";

function loadActiveThemeId(): string {
  try {
    const stored = localStorage.getItem(ACTIVE_THEME_STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch {}
  return "default-dark";
}

function saveActiveThemeId(themeId: string): void {
  try {
    localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, themeId);
  } catch {}
}

function loadCustomThemes(): ThemeConfig[] {
  try {
    const stored = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return [];
}

function saveCustomThemes(customThemes: ThemeConfig[]): void {
  try {
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customThemes));
  } catch {}
}

interface ConfigState {
  config: AppConfig;
  customProviders: CustomProviderConfig[];
  isSettingsOpen: boolean;
  activeThemeId: string;
  customThemes: ThemeConfig[];

  setConfig: (config: AppConfig) => void;
  setCustomProviders: (providers: CustomProviderConfig[]) => void;
  addCustomProvider: (provider: CustomProviderConfig) => void;
  removeCustomProvider: (name: string) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setActiveThemeId: (themeId: string) => void;
  addCustomTheme: (theme: ThemeConfig) => void;
  updateCustomTheme: (themeId: string, theme: Partial<ThemeConfig>) => void;
  deleteCustomTheme: (themeId: string) => void;
  getAllThemes: () => ThemeConfig[];
  getActiveTheme: () => ThemeConfig;
}

export const useConfigStore = create<ConfigState>((set, get) => {
  const initialActiveThemeId = loadActiveThemeId();
  const initialCustomThemes = loadCustomThemes();

  return {
    config: { thinkingLevel: "medium", customProviders: [], activeThemeId: initialActiveThemeId },
    customProviders: [],
    isSettingsOpen: false,
    activeThemeId: initialActiveThemeId,
    customThemes: initialCustomThemes,

    setConfig: (config) => set({ config, customProviders: config.customProviders || [] }),
    setCustomProviders: (providers) => set({ customProviders: providers }),
    addCustomProvider: (provider) =>
      set((s) => ({
        customProviders: [...s.customProviders.filter((p) => p.name !== provider.name), provider],
      })),
    removeCustomProvider: (name) =>
      set((s) => ({
        customProviders: s.customProviders.filter((p) => p.name !== name),
      })),
    setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),

    setActiveThemeId: (themeId) => {
      const allThemes = get().getAllThemes();
      const theme = allThemes.find((t) => t.id === themeId);

      if (theme) {
        set({ activeThemeId: themeId });
        saveActiveThemeId(themeId);
        applyThemeToDOM(theme);
      }
    },

    addCustomTheme: (theme) => {
      set((s) => ({
        customThemes: [
          ...s.customThemes,
          { ...theme, id: generateId(), isPreset: false, isBuiltIn: false },
        ],
      }));
      saveCustomThemes(get().customThemes);
    },

    updateCustomTheme: (themeId, updates) => {
      set((s) => ({
        customThemes: s.customThemes.map((t) => (t.id === themeId ? { ...t, ...updates } : t)),
      }));
      saveCustomThemes(get().customThemes);
    },

    deleteCustomTheme: (themeId) => {
      set((s) => {
        const filtered = s.customThemes.filter((t) => t.id !== themeId);
        const currentThemeId = s.activeThemeId;

        if (currentThemeId === themeId) {
          set({ activeThemeId: "default-dark" });
          saveActiveThemeId("default-dark");
        }

        return { customThemes: filtered };
      });
      saveCustomThemes(get().customThemes);
    },

    getAllThemes: () => {
      return [...BUILT_IN_THEMES, ...get().customThemes];
    },

    getActiveTheme: () => {
      return (
        get()
          .getAllThemes()
          .find((t) => t.id === get().activeThemeId) || BUILT_IN_THEMES[0]
      );
    },
  };
});
