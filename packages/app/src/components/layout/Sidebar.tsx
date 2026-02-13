import { useEffect, useState } from "react";
import { useSessions } from "@/hooks/useSessions";
import { useConfigStore } from "@/stores/configStore";
import { useSessionStore } from "@/stores/sessionStore";
import { Plus, MessageSquare, Trash2, Settings, Folder, Bot, Hash, Coins, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectDirectory, isTauri } from "@/lib/tauri";
import { AgentSelector } from "@/components/agents/AgentSelector";

function SessionStatsBar() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sessionStats = useSessionStore((s) => s.sessionStats);
  const contextUsage = useSessionStore((s) => s.contextUsage);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const isCompacting = useSessionStore((s) => s.isCompacting);
  const refreshSessionStats = useSessionStore((s) => s.refreshSessionStats);

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

  if (!activeSessionId) return null;

  return (
    <div className="px-2 py-1.5 border-t border-sidebar-border text-xs text-muted-foreground space-y-1">
      {isCompacting && (
        <div className="flex items-center gap-1.5 text-yellow-500 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Compacting context...</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Hash className="w-3 h-3" />
          <span>{sessionStats?.messageCount ?? 0} msgs</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins className="w-3 h-3" />
          <span>{sessionStats?.cost?.toFixed(4) ?? "0.0000"}</span>
        </div>
      </div>
      {contextUsage && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">Context</span>
            <span>
              {((contextUsage.tokens / 1000) | 0)}k / {((contextUsage.contextWindow / 1000) | 0)}k
            </span>
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
          <span className="text-sm font-semibold tracking-wide">Friend</span>
          <button
            onClick={handleNewSession}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            title="New session"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showPathInput && (
        <div className="p-2 border-b border-sidebar-border space-y-2">
          <label className="text-xs text-muted-foreground">Working directory (optional)</label>
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
              Create
            </button>
            <button
              onClick={() => {
                setShowPathInput(false);
                setSelectedAgentId(null);
              }}
              className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Sessions
        </div>
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => switchSession(session.id)}
            className={cn(
              "group flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
              activeSessionId === session.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50 text-muted-foreground",
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 overflow-hidden">
              {editingSessionId === session.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit();
                    if (e.key === "Escape") handleRenameCancel();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="w-full bg-secondary border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <span
                  className="truncate block group-hover:text-foreground transition-colors"
                  onDoubleClick={() => handleStartRename(session.id, session.name)}
                >
                  {session.name}
                </span>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                {session.agentId && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                    <Bot className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[80px]">{session.agentId}</span>
                  </div>
                )}
                {session.workingPath && editingSessionId !== session.id && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground/70 flex-1 min-w-0">
                    <Folder className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{session.workingPath}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {editingSessionId === session.id ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameSubmit();
                    }}
                    className="p-0.5 rounded hover:bg-green-500/20 transition-all flex-shrink-0"
                    title="Save"
                  >
                    ✓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameCancel();
                    }}
                    className="p-0.5 rounded hover:bg-destructive/20 transition-all flex-shrink-0"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(session.id, session.name);
                    }}
                    className="p-0.5 rounded hover:bg-accent transition-all flex-shrink-0"
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="p-0.5 rounded hover:bg-destructive/20 transition-all flex-shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="px-2 py-8 text-center text-xs text-muted-foreground">
            No sessions yet.
            <br />
            Click + to start.
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
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
