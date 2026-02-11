import { useRef, useEffect } from "react";
import type { ChatMessage } from "@friend/shared";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { ThinkingBlock } from "./ThinkingBlock";

interface MessageListProps {
  messages: ChatMessage[];
  streamingText: string;
  streamingThinking: string;
  isStreaming: boolean;
}

export function MessageList({
  messages,
  streamingText,
  streamingThinking,
  isStreaming,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, streamingThinking]);

  // Filter to only user and assistant messages for the chat view
  const chatMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {chatMessages.map((msg) => {
        if (msg.role === "user") {
          return <UserMessage key={msg.id} message={msg} />;
        }
        return <AssistantMessage key={msg.id} message={msg} />;
      })}

      {/* Streaming indicator */}
      {isStreaming && (streamingText || streamingThinking) && (
        <div className="space-y-2">
          {streamingThinking && <ThinkingBlock content={streamingThinking} isStreaming />}
          {streamingText && (
            <div className="prose prose-invert prose-sm max-w-none">
              <AssistantMessage
                message={{
                  role: "assistant",
                  id: "__streaming__",
                  content: [{ type: "text", text: streamingText }],
                  timestamp: new Date().toISOString(),
                }}
                isStreaming
              />
            </div>
          )}
        </div>
      )}

      {isStreaming && !streamingText && !streamingThinking && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <span>Thinking...</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
