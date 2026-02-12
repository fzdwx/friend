import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type {
  Message,
  UserMessage as PiUserMessage,
  AssistantMessage as PiAssistantMessage,
} from "@friend/shared";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { useSessionStore } from "@/stores/sessionStore";
import { SessionStatus } from "./SessionStatus";
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
  const setActiveTurnIndex = useSessionStore((s) => s.setActiveTurnIndex);

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

  // Build chat messages with their turn indices
  const chatMessagesWithTurns = useMemo(() => {
    const result: { msg: Message; turnIndex: number }[] = [];
    let turnIndex = -1;

    for (const m of messages) {
      if (m.role === "user") {
        turnIndex++;
        result.push({ msg: m, turnIndex });
      } else if (m.role === "assistant") {
        const content = m.content;
        if (!content || content.length === 0) continue;
        const hasText = content.some((block) => block.type === "text" && block.text.trim() !== "");
        if (hasText && turnIndex >= 0) {
          result.push({ msg: m, turnIndex });
        }
      }
    }
    return result;
  }, [messages]);

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-3">
      {chatMessagesWithTurns.map(({ msg, turnIndex }, i) => {
        if (msg.role === "user") {
          return (
            <div
              key={`user-${msg.timestamp}-${i}`}
              className="cursor-pointer"
              onClick={() => setActiveTurnIndex(turnIndex)}
            >
              <UserMessage message={msg as PiUserMessage} />
            </div>
          );
        }
        if (msg.role === "assistant") {
          return (
            <div
              key={`assistant-${msg.timestamp}-${i}`}
              className="cursor-pointer"
              onClick={() => setActiveTurnIndex(turnIndex)}
            >
              <AssistantMessage message={msg as PiAssistantMessage} />
            </div>
          );
        }
        return null;
      })}

      {/* Streaming text - isolated to avoid re-rendering historical messages */}
      {isStreaming && (
        <StreamingText scrollToBottom={scrollToBottom} userScrolledRef={userScrolledRef} />
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
 * Only renders streaming text as a bubble.
 * Thinking and tool calls are shown in ActivityPanel.
 */
function StreamingText({
  scrollToBottom,
  userScrolledRef,
}: {
  scrollToBottom: () => void;
  userScrolledRef: React.RefObject<boolean>;
}) {
  const streamingText = useSessionStore((s) => s.streamingText);

  // Auto-scroll when streaming text changes
  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom();
    }
  }, [streamingText, scrollToBottom, userScrolledRef]);

  return (
    <>
      {streamingText && (
        <AssistantMessage
          message={
            {
              role: "assistant",
              content: [{ type: "text", text: streamingText }],
              timestamp: Date.now(),
            } as PiAssistantMessage
          }
          isStreaming
        />
      )}
      <SessionStatus />
    </>
  );
}
