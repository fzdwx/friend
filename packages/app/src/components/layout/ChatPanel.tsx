import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/stores/sessionStore";
import { MessageList } from "@/components/chat/MessageList";
import { InputArea } from "@/components/chat/InputArea";
import { MessageSquarePlus } from "lucide-react";

export function ChatPanel() {
  const { sessionId, messages, isStreaming, sendMessage, abort } = useSession();
  const streamingText = useSessionStore((s) => s.streamingText);
  const streamingThinking = useSessionStore((s) => s.streamingThinking);

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <MessageSquarePlus className="w-10 h-10" />
        <p className="text-sm">Select or create a session to start</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        streamingText={streamingText}
        streamingThinking={streamingThinking}
        isStreaming={isStreaming}
      />
      <InputArea
        onSend={sendMessage}
        onAbort={abort}
        isStreaming={isStreaming}
        disabled={!sessionId}
      />
    </div>
  );
}
