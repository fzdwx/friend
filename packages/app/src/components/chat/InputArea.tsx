import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Square, Zap, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelSelector } from "@/components/ModelSelector";
import { useTranslation } from "react-i18next";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  }, [input, disabled, onSend]);

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
      if (e.key === "Enter" && !e.shiftKey) {
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
      } else if (e.key === "Escape" && isStreaming) {
        e.preventDefault();
        onAbort();
      }
    },
    [handleSend, handleSteer, handleFollowUp, isStreaming, onAbort],
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
      <div className="bg-secondary/30 rounded-lg border border-border px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
