import { useEffect } from "react";
import { useSessions } from "@/hooks/useSessions";
import { useConfigStore } from "@/stores/configStore";
import { Plus, MessageSquare, Trash2, Settings, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectDirectory } from "@/lib/tauri";

export function Sidebar() {
  const { sessions, activeSessionId, loadSessions, createSession, switchSession, deleteSession } =
    useSessions();
  const setIsSettingsOpen = useConfigStore((s) => s.setIsSettingsOpen);

  const handleNewSession = async () => {
    const workingPath = await selectDirectory();
    createSession({ workingPath: workingPath || undefined });
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

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Sessions
        </div>
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              "group flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
              activeSessionId === session.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50 text-muted-foreground",
            )}
            onClick={() => switchSession(session.id)}
          >
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <span className="truncate block">{session.name}</span>
              {session.workingPath && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground/70">
                  <Folder className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{session.workingPath}</span>
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(session.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 transition-all flex-shrink-0"
            >
              <Trash2 className="w-3 h-3 text-muted-foreground" />
            </button>
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
