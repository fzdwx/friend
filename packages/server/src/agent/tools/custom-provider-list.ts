import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { CustomProviderConfig } from "@friend/shared";
import type { IAgentManager } from "../managers/types.js";

// ─── Tool Definition ───────────────────────────────────────

export function createListProvidersTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "list_custom_providers",
    label: "List Custom Providers",
    description:
      "List all custom OpenAI-compatible LLM providers that have been registered. " +
      "Returns provider names, base URLs, API protocols, and their models.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      try {
        const providers = manager.getCustomProviders();

        if (providers.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No custom providers have been registered yet.",
              },
            ],
            details: undefined,
          };
        }

        const lines = providers.map((p) => {
          const modelInfo = p.models
            .map((m) => `  - ${m.name} (${m.id}): ${m.contextWindow}k context, reasoning=${m.reasoning}`)
            .join("\n");
          return `**${p.name}** (${p.baseUrl})\n  API: ${p.api ?? "openai-completions"}\n${modelInfo}`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${providers.length} custom provider(s):\n\n${lines.join("\n\n")}`,
            },
          ],
          details: { providers },
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list providers: ${String(err)}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
