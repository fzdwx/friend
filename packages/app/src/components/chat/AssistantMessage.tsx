import { memo } from "react";
import type { AssistantMessage as PiAssistantMessage } from "@friend/shared";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantMessageProps {
  message: PiAssistantMessage;
  isStreaming?: boolean;
}

export const AssistantMessage = memo(function AssistantMessage({ message, isStreaming }: AssistantMessageProps) {
  const textBlocks = message.content.filter(b => b.type === "text" && b.text.trim() !== "");
  if (textBlocks.length === 0) return null;

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-secondary px-4 py-2.5">
        {isStreaming && (
          <div className="text-[10px] text-yellow-500 animate-pulse mb-1">streaming...</div>
        )}
        <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-background/50 [&_pre]:p-3 [&_pre]:rounded-md [&_code]:text-xs [&_p]:leading-relaxed [&_p:last-child]:mb-0">
          {textBlocks.map((block, i) => (
            <Markdown key={i} remarkPlugins={[remarkGfm]}>
              {block.type === "text" ? block.text : ""}
            </Markdown>
          ))}
        </div>
      </div>
    </div>
  );
});
