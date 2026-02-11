import { useEffect } from "react";
import { ResizableLayout } from "@/components/layout/ResizableLayout";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { ActivityPanel } from "@/components/layout/ActivityPanel";
import { StatusBar } from "@/components/layout/StatusBar";
import { SettingsModal } from "@/components/config/SettingsModal";
import { useGlobalSSE } from "@/hooks/useSSE";
import { useApi } from "@/hooks/useApi";
import { useConfigStore } from "@/stores/configStore";
import { applyThemeToDOM } from "@/lib/theme";

function SSEConnector() {
  useGlobalSSE();
  return null;
}

export function App() {
  const { loadConfig } = useApi();
  const isSettingsOpen = useConfigStore((s) => s.isSettingsOpen);
  const activeThemeId = useConfigStore((s) => s.activeThemeId);
  const getActiveTheme = useConfigStore((s) => s.getActiveTheme);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const theme = getActiveTheme();
    if (theme) {
      applyThemeToDOM(theme);
    }
  }, [activeThemeId, getActiveTheme]);

  return (
    <>
      <SSEConnector />
      <ResizableLayout
        sidebar={<Sidebar />}
        main={
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-hidden">
              <ChatPanel />
            </div>
          </div>
        }
        activity={<ActivityPanel />}
        statusBar={<StatusBar />}
      />
      {isSettingsOpen && <SettingsModal />}
    </>
  );
}
