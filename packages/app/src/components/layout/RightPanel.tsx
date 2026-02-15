/**
 * Right panel with tabs for Activity and Files
 */

import { useState, useEffect } from "react";
import { Activity, FolderOpen, Circle } from "lucide-react";
import { ActivityPanel } from "./ActivityPanel";
import { FilePanel } from "@/components/files/FilePanel";
import { useSessionStore } from "@/stores/sessionStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type TabType = "activity" | "files";

const STORAGE_KEY = "friend-right-panel-tab";

function loadTab(): TabType {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "activity" || saved === "files") {
      return saved;
    }
  } catch {}
  return "activity";
}

function saveTab(tab: TabType) {
  localStorage.setItem(STORAGE_KEY, tab);
}

export function RightPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>(loadTab);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const sseConnected = useSessionStore((s) => s.sseConnected);

  useEffect(() => {
    saveTab(activeTab);
  }, [activeTab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Tab Header */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => handleTabChange("activity")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "activity"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{t("activity.title")}</span>
          {/* Streaming indicator */}
          {isStreaming && (
            <Circle className="w-2 h-2 fill-yellow-500 text-yellow-500 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => handleTabChange("files")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "files"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>{t("files.title")}</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "activity" ? (
          <ActivityPanel hideHeader />
        ) : (
          <FilePanel />
        )}
      </div>

      {/* SSE Connection Status Footer (only for activity tab) */}
      {activeTab === "activity" && (
        <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <Circle
              className={cn(
                "w-2 h-2",
                isStreaming
                  ? "fill-yellow-500 text-yellow-500 animate-pulse"
                  : sseConnected
                    ? "fill-emerald-500 text-emerald-500"
                    : "fill-red-500 text-red-500",
              )}
            />
            <span
              className={cn(
                "font-medium",
                isStreaming
                  ? "text-yellow-500"
                  : sseConnected
                    ? "text-emerald-500"
                    : "text-red-500",
              )}
            >
              {isStreaming
                ? t("activity.streaming")
                : sseConnected
                  ? t("activity.connected")
                  : t("activity.disconnected")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
