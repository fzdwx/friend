import { memo, useState, useCallback } from "react";
import type { AssistantMessage as PiAssistantMessage } from "@friend/shared";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Copy, Check } from "lucide-react";

interface AssistantMessageProps {
  message: PiAssistantMessage;
  isStreaming?: boolean;
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  isStreaming,
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);
  const textBlocks = message.content.filter((b) => b.type === "text" && b.text.trim() !== "");
  if (textBlocks.length === 0) return null;

  const fullText = textBlocks
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n\n");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = fullText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [fullText]);

  return (
    <div className="flex justify-start group">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted/30 px-4 py-2.5 relative">
        {/* Copy message button */}
        {!isStreaming && (
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
        )}
        {isStreaming && (
          <div className="text-[10px] text-yellow-500 animate-pulse mb-1">streaming...</div>
        )}
        <MarkdownRenderer className="[&_p]:leading-relaxed [&_p:last-child]:mb-0">
          {fullText}
        </MarkdownRenderer>
      </div>
    </div>
  );
});
