import { useCallback } from "react";
import { api } from "@/lib/api";
import { useConfigStore } from "@/stores/configStore";

export function useApi() {
  const { setConfig } = useConfigStore();

  const loadConfig = useCallback(async () => {
    const res = await api.getConfig();
    if (res.ok && res.data) {
      setConfig(res.data);
    }
  }, [setConfig]);

  return { loadConfig };
}
