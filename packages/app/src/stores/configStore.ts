import { create } from "zustand";
import type { ModelInfo, AppConfig, CustomProviderConfig } from "@friend/shared";

interface ConfigState {
  models: ModelInfo[];
  config: AppConfig;
  customProviders: CustomProviderConfig[];

  setModels: (models: ModelInfo[]) => void;
  setConfig: (config: AppConfig) => void;
  setCustomProviders: (providers: CustomProviderConfig[]) => void;
  addCustomProvider: (provider: CustomProviderConfig) => void;
  removeCustomProvider: (name: string) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  models: [],
  config: { thinkingLevel: "medium", customProviders: [] },
  customProviders: [],

  setModels: (models) => set({ models }),
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
}));
