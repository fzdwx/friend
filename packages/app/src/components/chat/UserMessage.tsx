import type { UserChatMessage } from "@friend/shared";
import { User } from "lucide-react";

interface UserMessageProps {
  message: UserChatMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-1 font-medium">You</div>
        <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    </div>
  );
}
