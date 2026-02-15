/**
 * File content viewer with syntax highlighting
 * Uses @pierre/diffs for syntax highlighting (same as MarkdownRenderer)
 */

import { memo, useMemo } from "react";
import { File } from "@pierre/diffs/react";
import { X, FileText, AlertCircle, PanelRightClose, PanelRight } from "lucide-react";
import { useFileStore } from "@/stores/fileStore";
import { FileIcon } from "@/components/ui/FileIcon";
import { useConfigStore } from "@/stores/configStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// ─── File Viewer Component ───────────────────────────────────────

interface FileViewerProps {
  showFileTree?: boolean;
  onToggleFileTree?: () => void;
}

export const FileViewer = memo(function FileViewer({
  showFileTree = true,
  onToggleFileTree,
}: FileViewerProps) {
  const { t } = useTranslation();
  const { currentFile, fileLoading, fileError, clearFile } = useFileStore();
  const activeThemeId = useConfigStore((s) => s.activeThemeId);

  // Determine theme for syntax highlighting
  const isDark = activeThemeId.includes("dark");

  // Prepare file data for @pierre/diffs (must be before conditional returns)
  const fileData = useMemo(
    () =>
      currentFile
        ? {
            name: currentFile.name,
            contents: currentFile.content,
          }
        : null,
    [currentFile]
  );

  // Loading state
  if (fileLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-end px-3 py-2 border-b border-border shrink-0 bg-card">
          <button
            onClick={onToggleFileTree}
            className="p-1 rounded hover:bg-accent/50 transition-colors"
            title={showFileTree ? t("files.hideTree") : t("files.showTree")}
          >
            {showFileTree ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRight className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          <div className="animate-pulse">{t("files.loadingFile")}</div>
        </div>
      </div>
    );
  }

  // Error state
  if (fileError) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-end px-3 py-2 border-b border-border shrink-0 bg-card">
          <button
            onClick={onToggleFileTree}
            className="p-1 rounded hover:bg-accent/50 transition-colors"
            title={showFileTree ? t("files.hideTree") : t("files.showTree")}
          >
            {showFileTree ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRight className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 p-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <span className="text-destructive text-center">{fileError}</span>
        </div>
      </div>
    );
  }

  // No file selected
  if (!currentFile || !fileData) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with toggle button */}
        <div className="flex items-center justify-end px-3 py-2 border-b border-border shrink-0 bg-card">
          <button
            onClick={onToggleFileTree}
            className="p-1 rounded hover:bg-accent/50 transition-colors"
            title={showFileTree ? t("files.hideTree") : t("files.showTree")}
          >
            {showFileTree ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRight className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-3 p-4 text-center">
          <FileText className="w-12 h-12 opacity-20" />
          <span>{t("files.selectToView")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* File header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon filename={currentFile.name} size={16} />
          <span className="text-sm font-mono truncate" title={currentFile.path}>
            {currentFile.path}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {(currentFile.size / 1024).toFixed(1)}KB
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleFileTree}
            className="p-1 rounded hover:bg-accent/50 transition-colors"
            title={showFileTree ? t("files.hideTree") : t("files.showTree")}
          >
            {showFileTree ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRight className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={clearFile}
            className="p-1 rounded hover:bg-accent/50 transition-colors"
            title={t("files.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* File content with syntax highlighting */}
      <div className="flex-1 overflow-auto">
        <div
          className={cn(
            "[&_[data-diffs]]:rounded-none",
            "[&_[data-diffs]]:border-none",
            "[&_[data-code]]:p-4",
            "[&_[data-code]]:text-[13px]"
          )}
        >
          <File
            file={fileData}
            options={{
              disableFileHeader: true,
              theme: { dark: "pierre-dark", light: "pierre-light" },
              themeType: isDark ? "dark" : "light",
            }}
          />
        </div>
      </div>
    </div>
  );
});
