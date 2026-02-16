import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { IAgentManager } from "../managers/types.js";

// ─── Tool Parameters Schema ───────────────────────────────────

export const CreateSessionParams = Type.Object({
  name: Type.Optional(
    Type.String({
      description: "Optional name for the new session. If not provided, a default name will be used.",
    }),
  ),
  workingPath: Type.Optional(
    Type.String({
      description: "Optional working directory path for the new session. Defaults to current working directory.",
    }),
  ),
});

// ─── Tool Definition ───────────────────────────────────────

export function createCreateSessionTool(manager: IAgentManager, agentId: string): ToolDefinition {
  return {
    name: "create_session",
    label: "Create Session",
    description:
      "Create a new session with the current agent. " +
      "This is useful when you want to start a fresh conversation context. " +
      "The new session will be opened in the UI automatically.",
    parameters: CreateSessionParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { name, workingPath } = params as {
        name?: string;
        workingPath?: string;
      };

      try {
        if (!manager.createSessionWithAgent) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Session creation is not available in the current environment.",
              },
            ],
            details: undefined,
          };
        }

        const result = await manager.createSessionWithAgent(agentId, { name, workingPath });

        return {
          content: [
            {
              type: "text" as const,
              text: `Created new session "${result.name}" (ID: ${result.id})${result.workingPath ? ` in ${result.workingPath}` : ""}. The session is now open in the UI.`,
            },
          ],
          details: { sessionId: result.id, name: result.name },
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create session: ${String(err)}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
