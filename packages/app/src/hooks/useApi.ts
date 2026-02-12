import { useCallback } from "react";
import { api } from "@/lib/api";
import { useConfigStore } from "@/stores/configStore";

export function useApi() {
  const { setConfig, loadCustomThemes } = useConfigStore();

  const loadConfig = useCallback(async () => {
    const [configRes] = await Promise.all([api.getConfig(), loadCustomThemes()]);
    if (configRes.ok && configRes.data) {
      setConfig(configRes.data);
    }
  }, [setConfig, loadCustomThemes]);

  return { loadConfig };
}
