import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

// ─── Tool Parameters Schema ───────────────────────────────────

export const RenameSessionParams = Type.Object({
  sessionId: Type.Optional(
    Type.String({
      description: "The ID of the session to rename. If not provided, renames the current session.",
    }),
  ),
  newName: Type.String({
    description:
      "The new name for the session. Must be a descriptive, brief title (≤50 characters recommended).",
  }),
});

// ─── AgentManager Interface ─────────────────────────────────

export interface IRenameSessionManager {
  renameSession(id: string, name: string): Promise<{ success: boolean }>;
}

// ─── Tool Definition ───────────────────────────────────────

export function createRenameSessionTool(manager: IRenameSessionManager): ToolDefinition {
  return {
    name: "rename_session",
    label: "Rename Session",
    description:
      "Rename a session to make it easier to identify and organize conversations. " +
      "If no sessionId is provided, renames the current session.",
    parameters: RenameSessionParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { sessionId: requestedId, newName } = params as {
        sessionId?: string;
        newName: string;
      };

      const sessionId = requestedId || _ctx.sessionManager.getSessionId();

      if (!sessionId) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No session ID provided and could not determine current session.",
            },
          ],
          details: undefined,
        };
      }

      try {
        const result = await manager.renameSession(sessionId, newName);

        if (result.success) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Successfully renamed session to "${newName}"`,
              },
            ],
            details: undefined,
          };
        } else {
          return {
            content: [
              {
                type: "text" as const,
                text: "Failed to rename session: Session not found",
              },
            ],
            details: undefined,
          };
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to rename session: ${String(err)}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
