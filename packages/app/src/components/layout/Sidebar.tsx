import { useEffect, useState } from "react";
import { useSessions } from "@/hooks/useSessions";
import { useConfigStore } from "@/stores/configStore";
import { useSessionStore, type StreamingPhase } from "@/stores/sessionStore";
import { Plus, MessageSquare, Trash2, Settings, Folder, Bot, Hash, Coins, Loader2, Sparkles, Wrench, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectDirectory, isTauri } from "@/lib/tauri";
import { AgentSelector } from "@/components/agents/AgentSelector";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Streaming status indicator component
function StreamingIndicator({ phase }: { phase: StreamingPhase }) {
  const { t } = useTranslation();

  if (phase === "idle") return null;

  const getIndicator = () => {
    switch (phase) {
      case "thinking":
        return {
          icon: <Sparkles className="w-3 h-3 animate-pulse" />,
          text: t("sidebar.streaming.thinking"),
          color: "text-yellow-500",
          bg: "bg-yellow-500/10",
        };
      case "generating":
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: t("sidebar.streaming.generating"),
          color: "text-blue-500",
          bg: "bg-blue-500/10",
        };
      case "tool_calling":
      case "tool_executing":
        return {
          icon: <Wrench className="w-3 h-3 animate-bounce" />,
          text: t("sidebar.streaming.tool"),
          color: "text-purple-500",
          bg: "bg-purple-500/10",
        };
      default:
        return null;
    }
  };

  const indicator = getIndicator();
  if (!indicator) return null;

  return (
    <div className={cn(
      "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
      indicator.color,
      indicator.bg,
    )}>
      {indicator.icon}
      <span>{indicator.text}</span>
    </div>
  );
}

// Session item component to handle streaming state
function SessionItem({ 
  session, 
  isActive, 
  isEditing, 
  editingName, 
  onStartRename, 
  onRenameSubmit, 
  onRenameCancel, 
  onSetEditingName, 
  onDelete, 
  onSwitch,
  t 
}: { 
  session: { id: string; name: string; agentId?: string; workingPath?: string; isStreaming?: boolean };
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onStartRename: (id: string, name: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onSetEditingName: (name: string) => void;
  onDelete: (id: string) => void;
  onSwitch: (id: string) => void;
  t: (key: string) => string;
}) {
  // Get streaming state for this session from the store
  const isSessionStreaming = useSessionStore((state) => state.sessionStreamingStates[session.id] ?? session.isStreaming ?? false);

  return (
    <div
      onClick={() => onSwitch(session.id)}
      className={cn(
        "group flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 text-muted-foreground",
      )}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <MessageSquare className="w-3.5 h-3.5" />
        {isSessionStreaming && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        {isEditing ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => onSetEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit();
              if (e.key === "Escape") onRenameCancel();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-full bg-secondary border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className="truncate group-hover:text-foreground transition-colors"
              onDoubleClick={() => onStartRename(session.id, session.name)}
            >
              {session.name}
            </span>
            {isSessionStreaming && isActive && (
              <StreamingIndicator phase={useSessionStore.getState().streamingPhase} />
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          {session.agentId && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
              <Bot className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[80px]">{session.agentId}</span>
            </div>
          )}
          {session.workingPath && !isEditing && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground/70 flex-1 min-w-0">
              <Folder className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{session.workingPath}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {isEditing ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameSubmit();
              }}
              className="p-0.5 rounded hover:bg-green-500/20 transition-all flex-shrink-0"
              title={t("common.save")}
            >
              ✓
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameCancel();
              }}
              className="p-0.5 rounded hover:bg-destructive/20 transition-all flex-shrink-0"
              title={t("common.cancel")}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartRename(session.id, session.name);
              }}
              className="p-0.5 rounded hover:bg-accent transition-all flex-shrink-0"
              title={t("sidebar.rename")}
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.id);
              }}
              className="p-0.5 rounded hover:bg-destructive/20 transition-all flex-shrink-0"
              title={t("sidebar.delete")}
            >
              <Trash2 className="w-3 h-3 text-muted-foreground" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SessionStatsBar() {
  const { t } = useTranslation();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sessionStats = useSessionStore((s) => s.sessionStats);
  const contextUsage = useSessionStore((s) => s.contextUsage);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const isCompacting = useSessionStore((s) => s.isCompacting);
  const refreshSessionStats = useSessionStore((s) => s.refreshSessionStats);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh stats periodically when streaming
  useEffect(() => {
    if (!activeSessionId) return;
    refreshSessionStats(activeSessionId);

    if (isStreaming) {
      const interval = setInterval(() => {
        refreshSessionStats(activeSessionId);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [activeSessionId, isStreaming, refreshSessionStats]);

  const handleRefreshContext = async () => {
    if (!activeSessionId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await api.refreshContext(activeSessionId);
      if (result.ok) {
        toast.success(t("sidebar.contextRefreshed"));
      } else {
        toast.error(result.error || t("sidebar.contextRefreshFailed"));
      }
    } catch (err) {
      toast.error(t("sidebar.contextRefreshFailed"));
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!activeSessionId) return null;

  return (
    <div className="px-2 py-1.5 border-t border-sidebar-border text-xs text-muted-foreground space-y-1">
      {isCompacting && (
        <div className="flex items-center gap-1.5 text-yellow-500 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{t("sidebar.compacting")}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Hash className="w-3 h-3" />
          <span>{t("sidebar.msgs", { count: sessionStats?.messageCount ?? 0 })}</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins className="w-3 h-3" />
          <span>{sessionStats?.cost?.toFixed(4) ?? "0.0000"}</span>
        </div>
      </div>
      {contextUsage && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">{t("sidebar.context")}</span>
            <div className="flex items-center gap-1">
              <span>
                {((contextUsage.tokens / 1000) | 0)}k / {((contextUsage.contextWindow / 1000) | 0)}k
              </span>
              <button
                onClick={handleRefreshContext}
                disabled={isRefreshing || isStreaming}
                className={cn(
                  "p-0.5 rounded hover:bg-accent/50 transition-colors",
                  (isRefreshing || isStreaming) && "opacity-50 cursor-not-allowed"
                )}
                title={t("sidebar.refreshContext")}
              >
                <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
              </button>
            </div>
          </div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                contextUsage.percent > 80
                  ? "bg-destructive"
                  : contextUsage.percent > 60
                    ? "bg-yellow-500"
                    : "bg-primary",
              )}
              style={{ width: `${Math.min(contextUsage.percent, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const {
    sessions,
    activeSessionId,
    loadSessions,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
  } = useSessions();
  const setIsSettingsOpen = useConfigStore((s) => s.setIsSettingsOpen);
  const [showPathInput, setShowPathInput] = useState(false);
  const [pathValue, setPathValue] = useState("");
  const [pathError, setPathError] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleNewSession = async () => {
    if (isTauri()) {
      const workingPath = await selectDirectory();
      const result = await createSession({ 
        workingPath: workingPath || undefined,
        agentId: selectedAgentId || undefined,
      });
      if (result.error) setPathError(result.error);
    } else {
      setPathValue("");
      setPathError("");
      setShowPathInput(true);
    }
  };

  const handlePathSubmit = async () => {
    const trimmed = pathValue.trim();
    setPathError("");
    const result = await createSession({ 
      workingPath: trimmed || undefined,
      agentId: selectedAgentId || undefined,
    });
    if (result.error) {
      setPathError(result.error);
    } else {
      setShowPathInput(false);
      setPathValue("");
      setSelectedAgentId(null);
    }
  };

  const handleStartRename = (sessionId: string, currentName: string) => {
    setEditingSessionId(sessionId);
    setEditingName(currentName);
  };

  const handleRenameSubmit = async () => {
    if (!editingSessionId) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;

    const result = await renameSession(editingSessionId, trimmed);
    if (result.error) {
      setPathError(result.error);
    } else {
      setEditingSessionId(null);
      setEditingName("");
    }
  };

  const handleRenameCancel = () => {
    setEditingSessionId(null);
    setEditingName("");
  };

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide">{t("sidebar.title")}</span>
          <button
            onClick={handleNewSession}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            title={t("sidebar.newSession")}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showPathInput && (
        <div className="p-2 border-b border-sidebar-border space-y-2">
          <label className="text-xs text-muted-foreground">{t("sidebar.workingDirectory")}</label>
          <input
            type="text"
            value={pathValue}
            onChange={(e) => {
              setPathValue(e.target.value);
              setPathError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePathSubmit();
              if (e.key === "Escape") setShowPathInput(false);
            }}
            placeholder="/path/to/project"
            autoFocus
            className={cn(
              "w-full px-2 py-1.5 rounded-md bg-secondary border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring",
              pathError ? "border-destructive" : "border-border",
            )}
          />
          
          <AgentSelector 
            value={selectedAgentId}
            onChange={setSelectedAgentId}
          />
          
          {pathError && <p className="text-xs text-destructive">{pathError}</p>}
          <div className="flex gap-1.5">
            <button
              onClick={handlePathSubmit}
              className="flex-1 px-2 py-1 rounded-md bg-accent text-accent-foreground text-xs hover:bg-accent/80 transition-colors"
            >
              {t("sidebar.createSession")}
            </button>
            <button
              onClick={() => {
                setShowPathInput(false);
                setSelectedAgentId(null);
              }}
              className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {t("sidebar.sessions")}
        </div>
        {sessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            isActive={activeSessionId === session.id}
            isEditing={editingSessionId === session.id}
            editingName={editingName}
            onStartRename={handleStartRename}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={handleRenameCancel}
            onSetEditingName={setEditingName}
            onDelete={deleteSession}
            onSwitch={switchSession}
            t={t}
          />
        ))}
        {sessions.length === 0 && (
          <div className="px-2 py-8 text-center text-xs text-muted-foreground">
            {t("sidebar.noSessions")}
            <br />
            {t("sidebar.clickToStart")}
          </div>
        )}
      </div>

      <SessionStatsBar />
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{t("sidebar.settings")}</span>
        </button>
      </div>
    </div>
  );
}
