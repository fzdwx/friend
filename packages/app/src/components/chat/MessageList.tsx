import { useRef, useEffect, useState, useCallback } from "react";
import type { ChatMessage } from "@friend/shared";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import { SessionStatus } from "./SessionStatus";
import { useSessionStore } from "@/stores/sessionStore";
import { ArrowDown } from "lucide-react";

interface MessageListProps {
  messages: ChatMessage[];
  streamingText: string;
  streamingThinking: string;
  isStreaming: boolean;
}

const SCROLL_THRESHOLD = 80;

export function MessageList({
  messages,
  streamingText,
  streamingThinking,
  isStreaming,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const userScrolledRef = useRef(false);
  const streamingBlocks = useSessionStore((s) => s.streamingBlocks);
  const streamingPhase = useSessionStore((s) => s.streamingPhase);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  const checkAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Track user scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const atBottom = checkAtBottom();
        setIsAtBottom(atBottom);
        if (!atBottom) {
          userScrolledRef.current = true;
        } else {
          userScrolledRef.current = false;
        }
        ticking = false;
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [checkAtBottom]);

  // Auto-scroll when new content arrives, but only if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledRef.current && streamingPhase != "idle") {
      scrollToBottom();
    }
  }, [messages, streamingPhase, scrollToBottom]);

  useEffect(() => {
    if (activeSessionId) {
      userScrolledRef.current = false;
      setIsAtBottom(true);
      scrollToBottom();
    }
  }, [activeSessionId, scrollToBottom]);

  // Always scroll to bottom when user sends a new message
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      userScrolledRef.current = false;
      setIsAtBottom(true);
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const chatMessages = messages.filter((m) => {
    if (m.role === "user") return true;
    if (m.role === "assistant") {
      const content = m.content;
      if (!content || content.length === 0) return false;
      return content.some(
        (block) => block.type === "tool_call" || (block.text && block.text.trim() !== ""),
      );
    }
    return false;
  });

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {chatMessages.map((msg) => {
        if (msg.role === "user") {
          return <UserMessage key={msg.id} message={msg} />;
        }
        if (msg.role === "assistant") {
          return <AssistantMessage key={msg.id} message={msg} />;
        }
        return null;
      })}

      {/* Streaming content */}
      {isStreaming && (streamingText || streamingThinking || streamingBlocks.length > 0) && (
        <div className="space-y-2">
          {streamingThinking && <ThinkingBlock content={streamingThinking} isStreaming />}
          {streamingBlocks
            .filter((b) => b.type === "tool_call")
            .map((b) =>
              b.type === "tool_call" ? (
                <ToolCallBlock
                  key={b.toolCallId}
                  toolCallId={b.toolCallId}
                  toolName={b.toolName}
                  args={b.args}
                />
              ) : null,
            )}
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

      {isStreaming && <SessionStatus />}

      <div ref={bottomRef} />

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <button
          onClick={() => {
            userScrolledRef.current = false;
            setIsAtBottom(true);
            scrollToBottom();
          }}
          className="sticky bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-lg cursor-pointer"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
