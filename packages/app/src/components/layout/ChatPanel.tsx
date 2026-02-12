import { useSession } from "@/hooks/useSession";
import { MessageList } from "@/components/chat/MessageList";
import { InputArea } from "@/components/chat/InputArea";
import { MessageSquarePlus } from "lucide-react";

export function ChatPanel() {
  const { sessionId, messages, isStreaming, sendMessage, abort } = useSession();

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
      <MessageList messages={messages} isStreaming={isStreaming} />
      <InputArea
        onSend={sendMessage}
        onAbort={abort}
        isStreaming={isStreaming}
        disabled={!sessionId}
      />
    </div>
  );
}
