import { useState, useEffect, useRef, useMemo } from "react";
import { Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { SlashCommandInfo } from "@friend/shared";

interface CommandPaletteProps {
  commands: SlashCommandInfo[];
  query: string;
  onSelect: (command: SlashCommandInfo) => void;
  onClose: () => void;
}

export function CommandPalette({ commands, query, onSelect, onClose }: CommandPaletteProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredCommands, selectedIndex, onSelect, onClose]);

  if (filteredCommands.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 p-2 bg-popover border border-border rounded-lg shadow-lg z-50">
        <div className="text-sm text-muted-foreground text-center py-2">
          {t("commands.noResults")}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
      <div className="px-2 py-1.5 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">{t("commands.title")}</span>
      </div>
      <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
        {filteredCommands.map((cmd, index) => (
          <button
            key={cmd.name}
            data-index={index}
            onClick={() => onSelect(cmd)}
            className={cn(
              "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left transition-colors",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
          >
            <Command className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">/{cmd.name}</div>
              {cmd.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {cmd.description}
                </div>
              )}
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted-foreground bg-muted rounded">
              ↵
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
