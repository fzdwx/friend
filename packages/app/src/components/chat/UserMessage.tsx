import { memo } from "react";
import type { UserMessage as PiUserMessage } from "@friend/shared";
import { User } from "lucide-react";

interface UserMessageProps {
  message: PiUserMessage;
}

export const UserMessage = memo(function UserMessage({ message }: UserMessageProps) {
  const text = typeof message.content === "string"
    ? message.content
    : message.content.filter(b => b.type === "text").map(b => b.text).join("");

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-1 font-medium">You</div>
        <div className="text-sm whitespace-pre-wrap break-words">{text}</div>
      </div>
    </div>
  );
});
