/**
 * Notify Tool
 * 
 * Send a desktop notification to the user.
 * Uses Web Notification API on the frontend.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

// ─── Tool Parameters Schema ───────────────────────────────────

export const NotifyParams = Type.Object({
  title: Type.String({ description: "The title of the notification (e.g., '喝水提醒', '任务完成')" }),
  message: Type.String({ description: "The body message of the notification" }),
  icon: Type.Optional(Type.String({ description: "Optional emoji or icon to display (e.g., '💧', '✅')" })),
});

// ─── Tool Definition ──────────────────────────────────────────

export const notifyTool: ToolDefinition = {
  name: "notify",
  label: "Notify",
  description: "Send a desktop notification to the user. Use this for important alerts, reminders, or time-sensitive information that should grab the user's attention even when they're not looking at the chat.",
  parameters: NotifyParams,
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const { title, message, icon } = params as typeof NotifyParams.static;
    
    // Broadcast notification to frontend
    // Note: ctx.ui.notify takes (message: string, type?: "info" | "warning" | "error")
    const fullMessage = icon ? `${icon} ${title}: ${message}` : `${title}: ${message}`;
    ctx?.ui?.notify(fullMessage);
    
    return {
      content: [{ type: "text" as const, text: `Desktop notification sent: ${title} - ${message}` }],
      details: { title, message },
    };
  },
};
