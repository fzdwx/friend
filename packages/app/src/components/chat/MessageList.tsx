import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { Message, UserMessage as PiUserMessage, AssistantMessage as PiAssistantMessage, ToolResultMessage } from "@friend/shared";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolBlock } from "@/components/tools/ToolBlock";
import { SessionStatus } from "./SessionStatus";
import { useSessionStore } from "@/stores/sessionStore";
import { ArrowDown } from "lucide-react";

interface MessageListProps {
  messages: Message[];
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

  // Build a map of toolCallId → ToolResultMessage for historical tool results
  const toolResultsById = useMemo(() => {
    const map = new Map<string, ToolResultMessage>();
    for (const m of messages) {
      if (m.role === "toolResult") {
        map.set(m.toolCallId, m as ToolResultMessage);
      }
    }
    return map;
  }, [messages]);

  const chatMessages = useMemo(
    () =>
      messages.filter((m) => {
        if (m.role === "user") return true;
        if (m.role === "assistant") {
          const content = m.content;
          if (!content || content.length === 0) return false;
          return content.some(
            (block) =>
              block.type === "toolCall" ||
              (block.type === "text" && block.text.trim() !== ""),
          );
        }
        return false; // filter out toolResult
      }),
    [messages],
  );

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-4">
      {chatMessages.map((msg, i) => {
        if (msg.role === "user") {
          return <UserMessage key={`user-${msg.timestamp}-${i}`} message={msg as PiUserMessage} />;
        }
        if (msg.role === "assistant") {
          return <AssistantMessage key={`assistant-${msg.timestamp}-${i}`} message={msg as PiAssistantMessage} toolResults={toolResultsById} />;
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
          {streamingBlocks.map((tc) => (
            <ToolBlock
              key={tc.id}
              toolCallId={tc.id}
              toolName={tc.name}
              args={JSON.stringify(tc.arguments)}
              isStreaming
            />
          ))}
          {streamingText && (
            <div className="prose prose-invert prose-sm max-w-none">
              <AssistantMessage
                message={{
                  role: "assistant",
                  content: [{ type: "text", text: streamingText }],
                  timestamp: Date.now(),
                } as PiAssistantMessage}
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
