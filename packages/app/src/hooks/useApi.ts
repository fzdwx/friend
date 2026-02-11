import { useCallback } from "react";
import { api } from "@/lib/api";
import { useConfigStore } from "@/stores/configStore";

export function useApi() {
  const { setModels, setConfig } = useConfigStore();

  const loadModels = useCallback(async () => {
    const res = await api.getModels();
    if (res.ok && res.data) {
      setModels(res.data);
    }
  }, [setModels]);

  const loadConfig = useCallback(async () => {
    const res = await api.getConfig();
    if (res.ok && res.data) {
      setConfig(res.data);
    }
  }, [setConfig]);

  const setAuth = useCallback(async (provider: string, apiKey: string) => {
    await api.setAuth(provider, apiKey);
  }, []);

  return { loadModels, loadConfig, setAuth };
}
