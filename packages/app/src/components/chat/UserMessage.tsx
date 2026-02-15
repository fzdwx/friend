import { memo, useState, useCallback } from "react";
import type { UserMessage as PiUserMessage } from "@friend/shared";
import { Copy, Check } from "lucide-react";

interface UserMessageProps {
  message: PiUserMessage;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export const UserMessage = memo(function UserMessage({ message }: UserMessageProps) {
  const [copied, setCopied] = useState(false);

  const text =
    typeof message.content === "string"
      ? message.content
      : message.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <div className="flex justify-end group">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary/10 px-4 py-2.5 relative">
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
          title={copied ? "Copied!" : "Copy message"}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
        <div className="text-sm whitespace-pre-wrap break-words">{text}</div>
        {/* Timestamp */}
        {message.timestamp && (
          <div className="text-[10px] text-muted-foreground/60 mt-1.5 text-right">
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
});
