import { useEffect } from "react";
import { ResizableLayout } from "@/components/layout/ResizableLayout";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { ActivityPanel } from "@/components/layout/ActivityPanel";
import { StatusBar } from "@/components/layout/StatusBar";
import { ProviderSettings } from "@/components/config/ProviderSettings";
import { ModelSelector } from "@/components/ModelSelector";
import { useGlobalSSE } from "@/hooks/useSSE";
import { useApi } from "@/hooks/useApi";

function TopBar() {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-1.5 border-b border-border bg-background">
      <ModelSelector />
      <ProviderSettings />
    </div>
  );
}

function SSEConnector() {
  useGlobalSSE();
  return null;
}

export function App() {
  const { loadConfig } = useApi();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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
