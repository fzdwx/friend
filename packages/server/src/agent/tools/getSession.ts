import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { SessionDetail, Message } from "@friend/shared";
import type { IAgentManager } from "./addCustomProvider.js";

export const GetSessionParams = Type.Object({
  sessionId: Type.Optional(
    Type.String({
      description: "The ID of the session to get details for. If not provided, uses the current interactive session.",
    }),
  ),
  includeMessages: Type.Optional(
    Type.Boolean({
      description: "Whether to include the full message history. Defaults to false (meta info only).",
    }),
  ),
});

export function createGetSessionTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "get_session",
    label: "Get Session Info",
    description: "Get detailed information about the current session (or a specific session), including meta data and optionally the full message history.",
    parameters: GetSessionParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const p = params as { sessionId?: string; includeMessages?: boolean };
        const { sessionId: requestedId, includeMessages = false } = p;
        console.log("111111111111:::",_ctx.sessionManager.getSessionId)

        if (!manager.getSession) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Session information is not available in the current environment.",
              },
            ],
            details: undefined,
          };
        }

        // Try to get sessionId from context (current session) or params
        let sessionId = requestedId;

        // TypeScript: _ctx might have sessionId property when tool is called from a session
        if (!sessionId && _ctx && "sessionId" in _ctx && typeof _ctx.sessionId === "string") {
          sessionId = _ctx.sessionId as string;
        }

        if (!sessionId) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Session ID not provided and could not be determined from context. Please provide a sessionId parameter.",
              },
            ],
            details: undefined,
          };
        }

        const session = await manager.getSession(sessionId);

        if (!session) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Session "${sessionId}" not found. Please verify the session ID is correct.`,
              },
            ],
            details: { sessionId, error: "not_found" },
          };
        }

        const messages = session.messages || [];

        // Build response text
        let responseText = `Session "${session.name}" (${session.id})

📊 Meta Information:
  - Name: ${session.name}
  - Model: ${session.model || "N/A"}
  - Working Path: ${session.workingPath || "N/A"}
  - Message Count: ${session.messageCount}
  - Created: ${new Date(session.createdAt).toLocaleString()}
  - Updated: ${new Date(session.updatedAt).toLocaleString()}`;

        if (includeMessages) {
          const messageSummary = messages
            .map((m, i) => {
              const contentPreview =
                typeof m.content === "string"
                  ? m.content.slice(0, 200) + (m.content.length > 200 ? "..." : "")
                  : `[${m.content.length} content blocks]`;
              return `\n${i + 1}. [${m.role}] ${contentPreview}`;
            })
            .join("\n");

          responseText += `\n\n💬 Message History (${messages.length} messages):\n${messageSummary}`;

          const info = {
            id: session.id,
            name: session.name,
            model: session.model,
            workingPath: session.workingPath,
            messageCount: session.messageCount,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          };

          return {
            content: [{ type: "text" as const, text: responseText }],
            details: { session: info, messages },
          };
        }

        // Show preview of last 3 messages
        const previewMessages = messages.slice(-3);
        const messagesSummary = previewMessages
          .map((m) => {
            const contentPreview =
              typeof m.content === "string"
                ? m.content.slice(0, 100) + (m.content.length > 100 ? "..." : "")
                : `[${m.content.length} content blocks]`;
            return `\n- [${m.role}] ${contentPreview}`;
          })
          .join("\n");

        responseText += `\n\n💬 Last ${previewMessages.length} messages:\n${messagesSummary}\n\nUse includeMessages=true to get the full message history.`;

        const info = {
          id: session.id,
          name: session.name,
          model: session.model,
          workingPath: session.workingPath,
          messageCount: session.messageCount,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        };

        return {
          content: [{ type: "text" as const, text: responseText }],
          details: { session: info, messagePreview: previewMessages },
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to get session information: ${String(err)}` }],
          details: undefined,
        };
      }
    },
  };
}
