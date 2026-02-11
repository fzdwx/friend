import { useEffect } from "react";
import { ResizableLayout } from "@/components/layout/ResizableLayout";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { ActivityPanel } from "@/components/layout/ActivityPanel";
import { StatusBar } from "@/components/layout/StatusBar";
import { ModelSelector } from "@/components/config/ModelSelector";
import { ThinkingLevelSelector } from "@/components/config/ThinkingLevel";
import { ApiKeySettings } from "@/components/config/ApiKeySettings";
import { ProviderSettings } from "@/components/config/ProviderSettings";
import { useSSE } from "@/hooks/useSSE";
import { useApi } from "@/hooks/useApi";
import { useSessionStore } from "@/stores/sessionStore";

function TopBar() {
  return (
    <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-border bg-background">
      <ModelSelector />
      <ThinkingLevelSelector />
      <ProviderSettings />
      <ApiKeySettings />
    </div>
  );
}

function SSEConnector() {
  const sessionId = useSessionStore((s) => s.activeSessionId);
  useSSE(sessionId);
  return null;
}

export function App() {
  const { loadModels, loadConfig } = useApi();

  useEffect(() => {
    loadModels();
    loadConfig();
  }, [loadModels, loadConfig]);

  return (
    <>
      <SSEConnector />
      <ResizableLayout
        sidebar={<Sidebar />}
        main={
          <div className="flex flex-col h-full">
            <TopBar />
            <div className="flex-1 overflow-hidden">
              <ChatPanel />
            </div>
          </div>
        }
        activity={<ActivityPanel />}
        statusBar={<StatusBar />}
      />
    </>
  );
}
