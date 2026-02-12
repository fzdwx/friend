import { create } from "zustand";
import type { AppConfig, CustomProviderConfig, ThemeConfig } from "@friend/shared";
import { BUILT_IN_THEMES } from "@friend/shared";
import { applyThemeToDOM } from "@/lib/theme";
import { api } from "@/lib/api";

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
  updateCustomTheme: (themeId: string, updates: Partial<ThemeConfig>) => void;
  deleteCustomTheme: (themeId: string) => void;
  getAllThemes: () => ThemeConfig[];
  getActiveTheme: () => ThemeConfig;
  loadCustomThemes: () => Promise<void>;

  // Called from SSE handler — updates local state without calling backend
  _applyConfigEvent: (event: {
    activeThemeId?: string;
    addedTheme?: ThemeConfig;
    updatedTheme?: ThemeConfig;
    deletedThemeId?: string;
  }) => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: { thinkingLevel: "medium", customProviders: [], activeThemeId: "default-dark" },
  customProviders: [],
  isSettingsOpen: false,
  activeThemeId: "default-dark",
  customThemes: [],

  setConfig: (config) => {
    set({ config, customProviders: config.customProviders || [] });
    // Apply activeThemeId from backend config
    if (config.activeThemeId && config.activeThemeId !== get().activeThemeId) {
      const allThemes = [...BUILT_IN_THEMES, ...get().customThemes];
      const theme = allThemes.find((t) => t.id === config.activeThemeId);
      set({ activeThemeId: config.activeThemeId });
      if (theme) applyThemeToDOM(theme);
    }
  },
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
      applyThemeToDOM(theme);
      // Persist to backend
      api.setActiveTheme(themeId).catch((err) =>
        console.error("Failed to set active theme:", err),
      );
    }
  },

  addCustomTheme: (theme) => {
    const withDefaults = { ...theme, isPreset: false, isBuiltIn: false };
    set((s) => ({ customThemes: [...s.customThemes, withDefaults] }));
    // Persist to backend
    api.addTheme(withDefaults).catch((err) =>
      console.error("Failed to add custom theme:", err),
    );
  },

  updateCustomTheme: (themeId, updates) => {
    set((s) => ({
      customThemes: s.customThemes.map((t) => (t.id === themeId ? { ...t, ...updates } : t)),
    }));
    // Re-apply if this is the active theme
    const state = get();
    if (state.activeThemeId === themeId) {
      const theme = state.customThemes.find((t) => t.id === themeId);
      if (theme) applyThemeToDOM(theme);
    }
    // Persist to backend
    api.updateTheme(themeId, updates).catch((err) =>
      console.error("Failed to update custom theme:", err),
    );
  },

  deleteCustomTheme: (themeId) => {
    set((s) => {
      const filtered = s.customThemes.filter((t) => t.id !== themeId);
      if (s.activeThemeId === themeId) {
        const defaultTheme = BUILT_IN_THEMES.find((t) => t.id === "default-dark") ?? BUILT_IN_THEMES[0];
        applyThemeToDOM(defaultTheme);
        return { customThemes: filtered, activeThemeId: "default-dark" };
      }
      return { customThemes: filtered };
    });
    // Persist to backend
    api.deleteTheme(themeId).catch((err) =>
      console.error("Failed to delete custom theme:", err),
    );
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

  loadCustomThemes: async () => {
    const res = await api.getCustomThemes();
    if (res.ok && res.data) {
      set({ customThemes: res.data });
    }
  },

  _applyConfigEvent: (event) => {
    if (event.addedTheme) {
      set((s) => {
        // Avoid duplicates
        if (s.customThemes.some((t) => t.id === event.addedTheme!.id)) return s;
        return { customThemes: [...s.customThemes, event.addedTheme!] };
      });
    }
    if (event.updatedTheme) {
      set((s) => ({
        customThemes: s.customThemes.map((t) =>
          t.id === event.updatedTheme!.id ? event.updatedTheme! : t,
        ),
      }));
    }
    if (event.deletedThemeId) {
      set((s) => {
        const filtered = s.customThemes.filter((t) => t.id !== event.deletedThemeId);
        if (s.activeThemeId === event.deletedThemeId) {
          const defaultTheme = BUILT_IN_THEMES.find((t) => t.id === "default-dark") ?? BUILT_IN_THEMES[0];
          applyThemeToDOM(defaultTheme);
          return { customThemes: filtered, activeThemeId: "default-dark" };
        }
        return { customThemes: filtered };
      });
    }
    if (event.activeThemeId) {
      const allThemes = [...BUILT_IN_THEMES, ...get().customThemes];
      const theme = allThemes.find((t) => t.id === event.activeThemeId);
      set({ activeThemeId: event.activeThemeId });
      if (theme) applyThemeToDOM(theme);
    }
  },
}));
