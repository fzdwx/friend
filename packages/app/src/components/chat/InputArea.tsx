import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Square, Zap, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelSelector } from "@/components/ModelSelector";
import { CommandPalette } from "@/components/chat/CommandPalette";
import { useSessionStore } from "@/stores/sessionStore";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import type { SlashCommandInfo } from "@friend/shared";

interface InputAreaProps {
  onSend: (message: string) => void;
  onSteer: (message: string) => void;
  onFollowUp: (message: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function InputArea({ onSend, onSteer, onFollowUp, onAbort, isStreaming, disabled }: InputAreaProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { activeSessionId, availableCommands, loadCommands } = useSessionStore();

  // Load commands when session changes
  useEffect(() => {
    if (activeSessionId) {
      loadCommands(activeSessionId);
    }
  }, [activeSessionId, loadCommands]);

  // Detect "/" input to trigger command palette
  const handleInputChange = useCallback((value: string) => {
    setInput(value);

    // Check if input starts with "/"
    if (value.startsWith("/")) {
      const query = value.slice(1);
      setCommandQuery(query);
      setShowCommandPalette(true);
    } else {
      setShowCommandPalette(false);
    }
  }, []);

  // Handle command selection - insert command text into input
  const handleCommandSelect = useCallback((command: SlashCommandInfo) => {
    // Insert command with trailing space for parameters
    setInput(`/${command.name} `);
    setShowCommandPalette(false);
    // Focus textarea for user to type parameters
    textareaRef.current?.focus();
  }, []);

  // Close command palette
  const handleCommandPaletteClose = useCallback(() => {
    setShowCommandPalette(false);
    // Clear the "/" if palette is closed without selection
    if (input === "/") {
      setInput("");
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    // Check if it's a command (starts with /)
    if (trimmed.startsWith("/")) {
      // Parse command and args
      const parts = trimmed.slice(1).split(/\s+/);
      const commandName = parts[0];
      const args = parts.slice(1).join(" ");

      if (activeSessionId && commandName) {
        try {
          await api.executeCommand(activeSessionId, commandName, args || undefined);
        } catch (error) {
          console.error("Failed to execute command:", error);
        }
      }
      setInput("");
      return;
    }

    onSend(trimmed);
    setInput("");
  }, [input, disabled, onSend, activeSessionId]);

  const handleSteer = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSteer(trimmed);
    setInput("");
  }, [input, disabled, onSteer]);

  const handleFollowUp = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onFollowUp(trimmed);
    setInput("");
  }, [input, disabled, onFollowUp]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If command palette is open, let it handle keyboard events
      if (showCommandPalette && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Escape")) {
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        // If command palette is open and user presses Enter, the palette handles it
        if (showCommandPalette) {
          return;
        }
        e.preventDefault();
        if (isStreaming) {
          // Streaming: Enter = steer
          handleSteer();
        } else {
          handleSend();
        }
      } else if (e.key === "Enter" && e.shiftKey && isStreaming) {
        // Streaming: Shift+Enter = followUp
        e.preventDefault();
        handleFollowUp();
      } else if (e.key === "Escape" && isStreaming && !showCommandPalette) {
        e.preventDefault();
        onAbort();
      }
    },
    [handleSend, handleSteer, handleFollowUp, isStreaming, onAbort, showCommandPalette],
  );

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  }, [input]);

  const hasInput = input.trim() && !disabled;

  return (
    <div className="border-t border-border p-3">
      <div ref={containerRef} className="bg-secondary/30 rounded-lg border border-border px-3 py-2 relative">
        {/* Command Palette */}
        {showCommandPalette && availableCommands.length > 0 && (
          <CommandPalette
            commands={availableCommands}
            query={commandQuery}
            onSelect={handleCommandSelect}
            onClose={handleCommandPaletteClose}
          />
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? t('input.placeholderStreaming') : t('input.placeholder')}
            disabled={disabled}
            rows={1}
            className={cn(
              "flex-1 bg-transparent text-sm resize-none outline-none",
              "placeholder:text-muted-foreground/50",
              "min-h-[24px] max-h-[160px]",
            )}
          />
        </div>
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/50">
          <div className="flex items-center gap-1">
            <ModelSelector />
          </div>
          <div className="flex items-center gap-1">
            {isStreaming ? (
              <>
                <button
                  onClick={handleSteer}
                  disabled={!hasInput}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                    hasInput
                      ? "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 dark:text-yellow-400"
                      : "text-muted-foreground/30",
                  )}
                  title={t("input.steerHint")}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {t("input.steer")}
                </button>
                <button
                  onClick={handleFollowUp}
                  disabled={!hasInput}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                    hasInput
                      ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground/30",
                  )}
                  title={t("input.followUpHint")}
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  {t("input.followUp")}
                </button>
                <button
                  onClick={onAbort}
                  className="flex-shrink-0 p-1.5 rounded-md bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors"
                  title={t("input.stop")}
                >
                  <Square className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleSend}
                disabled={!hasInput}
                className={cn(
                  "flex-shrink-0 p-1.5 rounded-md transition-colors",
                  hasInput
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-muted-foreground/30",
                )}
                title={t("input.send")}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
