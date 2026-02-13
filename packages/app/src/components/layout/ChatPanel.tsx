import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/stores/sessionStore";
import { MessageList } from "@/components/chat/MessageList";
import { InputArea } from "@/components/chat/InputArea";
import { StreamingTurn } from "@/components/activity/StreamingTurn";
import { MessageSquarePlus, Zap } from "lucide-react";

function PendingMessages() {
  const steeringMessages = useSessionStore((s) => s.steeringMessages);
  const followUpMessages = useSessionStore((s) => s.followUpMessages);

  if (steeringMessages.length === 0 && followUpMessages.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
      {steeringMessages.map((msg, i) => (
        <div key={`steer-${i}`} className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 py-0.5">
          <Zap className="w-3 h-3 flex-shrink-0" />
          <span className="font-medium">Steering:</span>
          <span className="truncate">{msg}</span>
        </div>
      ))}
      {followUpMessages.map((msg, i) => (
        <div key={`followup-${i}`} className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 py-0.5">
          <MessageSquarePlus className="w-3 h-3 flex-shrink-0" />
          <span className="font-medium">Follow-up:</span>
          <span className="truncate">{msg}</span>
        </div>
      ))}
    </div>
  );
}

export function ChatPanel() {
  const { sessionId, messages, isStreaming, sendMessage, steer, followUp, abort } = useSession();

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
      {isStreaming && (
        <div className="px-4 pb-2">
          <StreamingTurn />
        </div>
      )}
      <PendingMessages />
      <InputArea
        onSend={sendMessage}
        onSteer={steer}
        onFollowUp={followUp}
        onAbort={abort}
        isStreaming={isStreaming}
        disabled={!sessionId}
      />
    </div>
  );
}
