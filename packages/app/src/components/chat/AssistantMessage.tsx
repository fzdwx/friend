import { memo } from "react";
import type { AssistantMessage as PiAssistantMessage, TextContent, ThinkingContent, ToolCall, ToolResultMessage } from "@friend/shared";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolBlock } from "@/components/tools/ToolBlock";
import { Bot } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantMessageProps {
  message: PiAssistantMessage;
  isStreaming?: boolean;
  toolResults?: Map<string, ToolResultMessage>;
}

export const AssistantMessage = memo(function AssistantMessage({ message, isStreaming, toolResults }: AssistantMessageProps) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent flex items-center justify-center">
        <Bot className="w-3.5 h-3.5 text-accent-foreground" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="text-xs text-muted-foreground mb-1 font-medium">
          Assistant
          {isStreaming && <span className="ml-2 text-yellow-500 animate-pulse">streaming...</span>}
        </div>
        {message.content.map((block, i) => (
          <ContentBlock key={i} block={block} toolResults={toolResults} />
        ))}
      </div>
    </div>
  );
});

function ContentBlock({ block, toolResults }: { block: TextContent | ThinkingContent | ToolCall; toolResults?: Map<string, ToolResultMessage> }) {
  switch (block.type) {
    case "text":
      return (
        <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-secondary [&_pre]:p-3 [&_pre]:rounded-md [&_code]:text-xs [&_p]:leading-relaxed">
          <Markdown remarkPlugins={[remarkGfm]}>{block.text}</Markdown>
        </div>
      );
    case "thinking":
      return <ThinkingBlock content={block.thinking} />;
    case "toolCall": {
      const toolResult = toolResults?.get(block.id);
      return (
        <ToolBlock
          toolCallId={block.id}
          toolName={block.name}
          args={JSON.stringify(block.arguments)}
          toolResult={toolResult}
        />
      );
    }
  }
}
