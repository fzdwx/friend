import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { ChatMessage } from "@friend/shared";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolBlock } from "@/components/tools/ToolBlock";
import { SessionStatus } from "./SessionStatus";
import { useSessionStore } from "@/stores/sessionStore";
import { ArrowDown } from "lucide-react";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
}

const SCROLL_THRESHOLD = 80;

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const userScrolledRef = useRef(false);

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

  // Always scroll to bottom when user sends a new message
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      userScrolledRef.current = false;
      setIsAtBottom(true);
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Auto-scroll when messages change (e.g. finalized assistant message)
  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  const chatMessages = useMemo(
    () =>
      messages.filter((m) => {
        if (m.role === "user") return true;
        if (m.role === "assistant") {
          const content = m.content;
          if (!content || content.length === 0) return false;
          return content.some(
            (block) => block.type === "tool_call" || (block.text && block.text.trim() !== ""),
          );
        }
        return false;
      }),
    [messages],
  );

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-4">
      {chatMessages.map((msg) => {
        if (msg.role === "user") {
          return <UserMessage key={msg.id} message={msg} />;
        }
        if (msg.role === "assistant") {
          return <AssistantMessage key={msg.id} message={msg} />;
        }
        return null;
      })}

      {/* Streaming content - isolated to avoid re-rendering historical messages */}
      {isStreaming && (
        <StreamingContent
          scrollToBottom={scrollToBottom}
          userScrolledRef={userScrolledRef}
        />
      )}

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

/**
 * Reads streaming state from the store directly.
 * Re-renders independently from the historical message list.
 */
function StreamingContent({
  scrollToBottom,
  userScrolledRef,
}: {
  scrollToBottom: () => void;
  userScrolledRef: React.RefObject<boolean>;
}) {
  const streamingText = useSessionStore((s) => s.streamingText);
  const streamingThinking = useSessionStore((s) => s.streamingThinking);
  const streamingBlocks = useSessionStore((s) => s.streamingBlocks);
  const streamingPhase = useSessionStore((s) => s.streamingPhase);

  // Auto-scroll when streaming content changes
  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom();
    }
  }, [streamingText, streamingThinking, streamingBlocks, streamingPhase, scrollToBottom, userScrolledRef]);

  const hasContent = streamingText || streamingThinking || streamingBlocks.length > 0;

  return (
    <>
      {hasContent && (
        <div className="space-y-2">
          {streamingThinking && <ThinkingBlock content={streamingThinking} isStreaming />}
          {streamingBlocks
            .filter((b) => b.type === "tool_call")
            .map((b) =>
              b.type === "tool_call" ? (
                <ToolBlock
                  key={b.toolCallId}
                  toolCallId={b.toolCallId}
                  toolName={b.toolName}
                  args={b.args}
                  isStreaming
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

      <SessionStatus />
    </>
  );
}
