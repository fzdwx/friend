/**
 * File tree component for browsing project files
 */

import { useEffect, useState, useCallback, memo } from "react";
import { ChevronRight, ChevronDown, RefreshCw, Search, X, Loader2 } from "lucide-react";
import { useFileStore, type FileTreeItem } from "@/stores/fileStore";
import { useSessionStore } from "@/stores/sessionStore";
import { FileIcon, FolderIcon } from "@/components/ui/FileIcon";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// ─── Tree Item Component ─────────────────────────────────────────

interface TreeItemProps {
  item: FileTreeItem;
  level: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (item: FileTreeItem) => void;
  onLoadChildren: (path: string) => void;
}

const TreeItem = memo(function TreeItem({
  item,
  level,
  expandedPaths,
  selectedPath,
  onToggle,
  onSelect,
  onLoadChildren,
}: TreeItemProps) {
  const isExpanded = expandedPaths.has(item.path);
  const isSelected = selectedPath === item.path;
  const isDirectory = item.type === "directory";
  const paddingLeft = level * 16 + 8;

  const handleClick = useCallback(() => {
    onSelect(item);
    
    if (isDirectory) {
      onToggle(item.path);
      // Load children if not already loaded
      if (!isExpanded && !item.children) {
        onLoadChildren(item.path);
      }
    }
  }, [item, isDirectory, onToggle, onSelect, isExpanded, onLoadChildren]);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 cursor-pointer text-sm",
          "hover:bg-accent/50 rounded select-none",
          isSelected && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isDirectory ? isExpanded : undefined}
      >
        {/* Expand/collapse indicator for directories */}
        {isDirectory ? (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {item.loading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        {/* File/folder icon */}
        {isDirectory ? (
          <FolderIcon name={item.name} expanded={isExpanded} size={16} />
        ) : (
          <FileIcon filename={item.name} size={16} />
        )}

        {/* Name */}
        <span className="truncate" title={item.name}>
          {item.name}
        </span>
      </div>

      {/* Children (if expanded) */}
      {isDirectory && isExpanded && item.children && (
        <div role="group">
          {item.children.map((child) => (
            <TreeItem
              key={child.path}
              item={child}
              level={level + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
              onLoadChildren={onLoadChildren}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ─── File Tree Component ─────────────────────────────────────────

export function FileTree() {
  const { t } = useTranslation();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const {
    tree,
    treeLoading,
    treeError,
    expandedPaths,
    loadTree,
    toggleExpand,
    loadFile,
    clearFile,
  } = useFileStore();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Load tree when session changes
  useEffect(() => {
    if (activeSessionId) {
      loadTree(activeSessionId);
    }
  }, [activeSessionId, loadTree]);

  // Handle tree item selection
  const handleSelect = useCallback(
    (item: FileTreeItem) => {
      setSelectedPath(item.path);

      if (item.type === "file" && activeSessionId) {
        loadFile(activeSessionId, item.path);
      }
    },
    [activeSessionId, loadFile]
  );

  // Handle directory expansion
  const handleToggle = useCallback(
    (path: string) => {
      toggleExpand(path);
    },
    [toggleExpand]
  );

  // Load children for a directory
  const handleLoadChildren = useCallback(
    (path: string) => {
      if (activeSessionId) {
        loadTree(activeSessionId, path);
      }
    },
    [activeSessionId, loadTree]
  );

  // Refresh tree
  const handleRefresh = useCallback(() => {
    if (activeSessionId) {
      loadTree(activeSessionId);
      setSelectedPath(null);
      clearFile();
    }
  }, [activeSessionId, loadTree, clearFile]);

  // Render loading state
  if (treeLoading && tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        {t("files.loading")}
      </div>
    );
  }

  // Render error state
  if (treeError) {
    return (
      <div className="flex flex-col items-center justify-center h-20 text-xs text-muted-foreground gap-2">
        <span className="text-destructive">{treeError}</span>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/50"
        >
          <RefreshCw className="w-3 h-3" />
          {t("common.retry")}
        </button>
      </div>
    );
  }

  // Render empty state
  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-20 text-xs text-muted-foreground gap-2">
        <span>{t("files.noFiles")}</span>
      </div>
    );
  }

  // Render tree
  return (
    <div className="flex flex-col h-full" role="tree">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {t("files.title")}
        </span>
        <button
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-accent/50 transition-colors"
          title={t("files.refresh")}
          disabled={treeLoading}
        >
          <RefreshCw className={cn("w-3 h-3", treeLoading && "animate-spin")} />
        </button>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.map((item) => (
          <TreeItem
            key={item.path}
            item={item}
            level={0}
            expandedPaths={expandedPaths}
            selectedPath={selectedPath}
            onToggle={handleToggle}
            onSelect={handleSelect}
            onLoadChildren={handleLoadChildren}
          />
        ))}
      </div>
    </div>
  );
}
