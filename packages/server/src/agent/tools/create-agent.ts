import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { IAgentManager } from "../managers/types.js";
import { createAgent, resolveAgentWorkspaceDir, type AgentConfig } from "../agent-manager.js";
import { ensureAgentWorkspace } from "../bootstrap.js";

// ─── Tool Parameters Schema ────────────────────────────────

export const CreateAgentParams = Type.Object({
  id: Type.Optional(
    Type.String({
      description:
        "Unique agent ID. If not provided, will be generated from name. Use lowercase letters, digits, and hyphens only.",
    }),
  ),
  name: Type.String({
    description: "Agent display name (e.g. 'Coder', 'Writer')",
  }),
  emoji: Type.Optional(
    Type.String({
      description: "Emoji for the agent (e.g. '💻', '✍️')",
    }),
  ),
  vibe: Type.Optional(
    Type.String({
      description:
        "Short description of the agent's personality/focus (e.g. 'Expert coding assistant')",
    }),
  ),
  model: Type.Optional(
    Type.String({
      description:
        "Default model for this agent in format 'provider/model-id' (e.g. 'anthropic/claude-sonnet-4-5')",
    }),
  ),
  workspace: Type.Optional(
    Type.String({
      description: "Working directory path for this agent",
    }),
  ),
});

// ─── Tool Definition ───────────────────────────────────────

export function createCreateAgentTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "create_agent",
    label: "Create Agent",
    description:
      "Create a new AI agent with custom identity and configuration. " +
      "The agent will have its own workspace, memory, and can be selected when creating sessions. " +
      "Use this when the user wants to create a specialized assistant for specific tasks.",
    parameters: CreateAgentParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { id, name, emoji, vibe, model, workspace } = params as {
        id?: string;
        name: string;
        emoji?: string;
        vibe?: string;
        model?: string;
        workspace?: string;
      };

      try {
        // Generate ID from name if not provided
        const agentId =
          id || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        // Create agent via API
        const agent: AgentConfig = await createAgent({
          id: agentId,
          name,
          identity: {
            name,
            emoji: emoji ?? undefined,
            vibe: vibe ?? undefined,
          },
          model: model ?? undefined,
          workspace: workspace ?? undefined,
        });

        // Ensure workspace with all bootstrap files (including BOOTSTRAP.md)
        const workspaceDir = resolveAgentWorkspaceDir(agentId);
        await ensureAgentWorkspace(workspaceDir, {
          agentName: name,
          agentEmoji: emoji || "🤖",
          agentVibe: vibe || "Helpful assistant",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Created agent "${name}" (ID: ${agentId})\n\n` +
                `Workspace: ${workspaceDir}\n` +
                `You can now select this agent when creating new sessions.`,
            },
          ],
          details: { agentId, name, workspace: workspaceDir },
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create agent: ${String(err)}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
