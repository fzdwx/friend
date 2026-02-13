import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/stores/sessionStore";
import { MessageList } from "@/components/chat/MessageList";
import { InputArea } from "@/components/chat/InputArea";
import { StreamingTurn } from "@/components/activity/StreamingTurn";
import { PlanEditor, PlanProgress } from "@/components/plan/PlanEditor";
import { MessageSquarePlus, Zap } from "lucide-react";
import { api } from "@/lib/api";

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

/**
 * Plan mode panel - shows PlanEditor when plan is ready,
 * PlanProgress during execution.
 */
function PlanModePanel() {
  const sessionId = useSessionStore((s) => s.activeSessionId);
  const planModeEnabled = useSessionStore((s) => s.planModeEnabled);
  const planModeExecuting = useSessionStore((s) => s.planModeExecuting);
  const planModeTodos = useSessionStore((s) => s.planModeTodos);
  const planModeProgress = useSessionStore((s) => s.planModeProgress);
  const isStreaming = useSessionStore((s) => s.isStreaming);

  const handleExecute = async (todos?: any[]) => {
    if (!sessionId) return;
    await api.planAction(sessionId, "execute", { todos });
  };

  const handleCancel = async () => {
    if (!sessionId) return;
    await api.planAction(sessionId, "cancel");
  };

  // Show progress during execution
  if (planModeExecuting && planModeTodos.length > 0) {
    return (
      <div className="px-4 py-2">
        <PlanProgress
          completed={planModeProgress?.completed ?? planModeTodos.filter(t => t.completed).length}
          total={planModeProgress?.total ?? planModeTodos.length}
          todos={planModeTodos}
        />
      </div>
    );
  }

  // Show editor when plan is ready
  if (planModeEnabled && planModeTodos.length > 0 && !planModeExecuting) {
    return (
      <div className="px-4 py-2">
        <PlanEditor
          todos={planModeTodos}
          onExecute={handleExecute}
          onCancel={handleCancel}
          disabled={isStreaming}
        />
      </div>
    );
  }

  return null;
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
      <PlanModePanel />
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
