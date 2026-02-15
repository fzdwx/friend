/**
 * File panel - combines file tree and file viewer
 */

import { useState, useCallback, useEffect } from "react";
import { Search, X } from "lucide-react";
import { FileTree } from "./FileTree";
import { FileViewer } from "./FileViewer";
import { useFileStore, type SearchResult } from "@/stores/fileStore";
import { useSessionStore } from "@/stores/sessionStore";
import { FileIcon } from "@/components/ui/FileIcon";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// ─── Search Results Component ────────────────────────────────────

function SearchResults({
  results,
  onSelect,
}: {
  results: SearchResult[];
  onSelect: (path: string) => void;
}) {
  const { t } = useTranslation();

  if (results.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        {t("files.noResults")}
      </div>
    );
  }

  return (
    <div className="py-1">
      {results.map((result) => (
        <button
          key={result.path}
          onClick={() => onSelect(result.path)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 text-sm",
            "hover:bg-accent/50 text-left"
          )}
        >
          <FileIcon filename={result.name} size={14} />
          <span className="truncate flex-1" title={result.path}>
            {result.path}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {(result.size / 1024).toFixed(1)}KB
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── File Panel Component ────────────────────────────────────────

export function FilePanel() {
  const { t } = useTranslation();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const {
    showFileTree,
    sidebarWidth,
    searchQuery,
    searchResults,
    searchLoading,
    loadFile,
    searchFiles,
    clearSearch,
    setSearchQuery,
    toggleFileTree,
    setSidebarWidth,
  } = useFileStore();

  const [showSearch, setShowSearch] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      if (activeSessionId) {
        searchFiles(activeSessionId, searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeSessionId, searchFiles]);

  // Handle search result selection
  const handleSearchSelect = useCallback(
    (path: string) => {
      if (activeSessionId) {
        loadFile(activeSessionId, path);
      }
      setShowSearch(false);
      clearSearch();
    },
    [activeSessionId, loadFile, clearSearch]
  );

  // Handle resize (from right side)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate width from right edge of viewport
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  // No session selected
  if (!activeSessionId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {t("files.noSession")}
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* File viewer - left side */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden">
          <FileViewer
            showFileTree={showFileTree}
            onToggleFileTree={toggleFileTree}
          />
        </div>
      </div>

      {/* File tree sidebar - right side */}
      {showFileTree && (
        <>
          {/* Resize handle */}
          <div
            className={cn(
              "w-1 bg-border hover:bg-primary/50 cursor-col-resize shrink-0",
              "transition-colors",
              isResizing && "bg-primary/50"
            )}
            onMouseDown={handleMouseDown}
          />

          <div
            className={cn(
              "flex flex-col border-l border-border bg-card shrink-0",
              isResizing && "select-none"
            )}
            style={{ width: sidebarWidth }}
          >
            {/* Search bar */}
            <div className="p-2 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearch(true);
                  }}
                  onFocus={() => setShowSearch(true)}
                  placeholder={t("files.searchPlaceholder")}
                  className={cn(
                    "w-full pl-7 pr-2 py-1.5 text-xs bg-secondary border border-border rounded",
                    "focus:outline-none focus:ring-1 focus:ring-ring"
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      clearSearch();
                      setShowSearch(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </button>
                )}

                {/* Search results dropdown */}
                {showSearch && searchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg z-50 max-h-64 overflow-y-auto">
                    {searchLoading ? (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        {t("files.searching")}
                      </div>
                    ) : (
                      <SearchResults
                        results={searchResults}
                        onSelect={handleSearchSelect}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* File tree */}
            <div className="flex-1 overflow-hidden">
              <FileTree />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
