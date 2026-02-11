import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputAreaProps {
  onSend: (message: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function InputArea({ onSend, onAbort, isStreaming, disabled }: InputAreaProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  }, [input, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) return;
        handleSend();
      }
    },
    [handleSend, isStreaming],
  );

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  }, [input]);

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2 bg-secondary/30 rounded-lg border border-border px-3 py-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 bg-transparent text-sm resize-none outline-none",
            "placeholder:text-muted-foreground/50",
            "min-h-[24px] max-h-[160px]",
          )}
        />
        {isStreaming ? (
          <button
            onClick={onAbort}
            className="flex-shrink-0 p-1.5 rounded-md bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className={cn(
              "flex-shrink-0 p-1.5 rounded-md transition-colors",
              input.trim() && !disabled
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground/30",
            )}
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex justify-between mt-1 px-1 text-[10px] text-muted-foreground/50">
        <span>Enter to send, Shift+Enter for new line</span>
      </div>
    </div>
  );
}
