import { memo } from "react";
import type { UserMessage as PiUserMessage } from "@friend/shared";

interface UserMessageProps {
  message: PiUserMessage;
}

export const UserMessage = memo(function UserMessage({ message }: UserMessageProps) {
  const text = typeof message.content === "string"
    ? message.content
    : message.content.filter(b => b.type === "text").map(b => b.text).join("");

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary/15 px-4 py-2.5">
        <div className="text-sm whitespace-pre-wrap break-words">{text}</div>
      </div>
    </div>
  );
});
