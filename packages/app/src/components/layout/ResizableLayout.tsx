import { useRef, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ResizableLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  activity: React.ReactNode;
  statusBar: React.ReactNode;
}

const STORAGE_KEY = "friend-panel-sizes";
const MIN_SIDEBAR = 180;
const MIN_ACTIVITY = 240;

function loadSizes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sidebar: 240, activity: 340 };
}

function saveSizes(sizes: { sidebar: number; activity: number }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
}

export function ResizableLayout({ sidebar, main, activity, statusBar }: ResizableLayoutProps) {
  const [sizes, setSizes] = useState(loadSizes);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"sidebar" | "activity" | null>(null);

  const onMouseDown = useCallback(
    (which: "sidebar" | "activity") => (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = which;

      const onMouseMove = (e: MouseEvent) => {
        if (!containerRef.current || !draggingRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        if (draggingRef.current === "sidebar") {
          const newWidth = Math.max(MIN_SIDEBAR, e.clientX - rect.left);
          setSizes((s: { sidebar: number; activity: number }) => {
            const updated = { ...s, sidebar: newWidth };
            saveSizes(updated);
            return updated;
          });
        } else {
          const newWidth = Math.max(MIN_ACTIVITY, rect.right - e.clientX);
          setSizes((s: { sidebar: number; activity: number }) => {
            const updated = { ...s, activity: newWidth };
            saveSizes(updated);
            return updated;
          });
        }
      };

      const onMouseUp = () => {
        draggingRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [],
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden relative">
      {statusBar}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <>
            <div
              className="flex-shrink-0 border-r border-border overflow-hidden"
              style={{ width: sizes.sidebar }}
            >
              {sidebar}
            </div>
            <div
              className="w-1 cursor-col-resize hover:bg-ring/50 transition-colors flex-shrink-0"
              onMouseDown={onMouseDown("sidebar")}
            />
          </>
        )}

        {/* Main */}
        <div className="flex-1 min-w-0 overflow-hidden">{main}</div>

        {/* Activity Panel */}
        {!activityCollapsed && (
          <>
            <div
              className="w-1 cursor-col-resize hover:bg-ring/50 transition-colors flex-shrink-0"
              onMouseDown={onMouseDown("activity")}
            />
            <div
              className="flex-shrink-0 border-l border-border overflow-hidden"
              style={{ width: sizes.activity }}
            >
              {activity}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
