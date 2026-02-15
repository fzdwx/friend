/**
 * Notify Tool
 * 
 * Send a desktop notification to the user.
 * Uses Web Notification API on the frontend.
 */

import type { Tool } from "./index.js";

export const notifyTool: Tool = {
  name: "notify",
  description: "Send a desktop notification to the user. Use this for important alerts, reminders, or time-sensitive information that should grab the user's attention even when they're not looking at the chat.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The title of the notification (e.g., '喝水提醒', '任务完成')",
      },
      message: {
        type: "string",
        description: "The body message of the notification",
      },
      icon: {
        type: "string",
        description: "Optional emoji or icon to display (e.g., '💧', '✅')",
      },
    },
    required: ["title", "message"],
  },
  execute: async (args, ctx) => {
    const { title, message, icon } = args;
    
    // Broadcast notification event to frontend
    if (ctx.ui && ctx.ui.notify) {
      ctx.ui.notify({
        type: "desktop_notification",
        title: icon ? `${icon} ${title}` : title,
        message,
      });
    }
    
    return `Desktop notification sent: ${title} - ${message}`;
  },
};
