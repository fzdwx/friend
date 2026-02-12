import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { IAgentManager } from "./addCustomProvider.js";

export const RenameSessionParams = Type.Object({
  sessionId: Type.String({
    description: "The ID of the session to rename. This is a unique identifier for the session.",
  }),
  newName: Type.String({
    description: "The new name for the session. Should be brief and descriptive (≤50 characters recommended).",
    minLength: 1,
    maxLength: 100,
  }),
});

export function createRenameSessionTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "rename_session",
    label: "Rename Session",
    description: "Rename a session to make it easier to identify and organize conversations. This broadcasts a session_renamed event to update the UI in real-time.",
    parameters: RenameSessionParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const p = params as { sessionId: string; newName: string };
        const { sessionId, newName } = p;

        if (!manager.renameSession) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Session renaming is not supported in the current environment.",
              },
            ],
            details: { sessionId, error: "not_supported" },
          };
        }

        const result = await manager.renameSession(sessionId, newName);

        if (!result.success) {
          if (result.error === "not_found") {
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
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to rename session "${sessionId}". The operation was not successful.`,
              },
            ],
            details: { sessionId, error: "rename_failed" },
          };
        }

        const oldName = result.oldName || "";
        if (oldName === newName) {
          return {
            content: [
              {
                type: "text" as const,
                text: `The session name is already "${newName}". No changes were made.`,
              },
            ],
            details: { sessionId, oldName, newName },
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully renamed session from "${oldName}" to "${newName}".`,
            },
          ],
          details: { sessionId, oldName, newName },
        };
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
