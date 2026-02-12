import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { CustomProviderConfig, ThemeConfig } from "@friend/shared";

// ─── Tool Parameters Schema ────────────────────────────────

export const AddCustomProviderParams = Type.Object({
  name: Type.String({ description: "Provider name (e.g. 'my-openai')" }),
  baseUrl: Type.String({
    description: "Base URL of the OpenAI-compatible API",
  }),
  apiKey: Type.Optional(
    Type.String({ description: "API key for authentication" }),
  ),
  api: Type.Optional(
    Type.String({
      description:
        'API protocol to use. Common values: "openai-completions", "anthropic-messages". Defaults to "openai-completions".',
    }),
  ),
  headers: Type.Optional(
    Type.Record(Type.String(), Type.String(), {
      description: "Extra HTTP headers",
    }),
  ),
  models: Type.Array(
    Type.Object({
      id: Type.String({
        description: "Model ID sent to the API (e.g. 'gpt-4o')",
      }),
      name: Type.String({
        description: "Human-readable display name",
      }),
      reasoning: Type.Boolean({
        description: "Whether the model supports extended thinking",
      }),
      contextWindow: Type.Number({
        description: "Max context window in tokens",
      }),
      maxTokens: Type.Number({
        description: "Max output tokens",
      }),
      cost: Type.Object({
        input: Type.Number({
          description: "Cost per 1M input tokens in USD",
        }),
        output: Type.Number({
          description: "Cost per 1M output tokens in USD",
        }),
        cacheRead: Type.Number({
          description: "Cost per 1M cache-read tokens in USD",
        }),
        cacheWrite: Type.Number({
          description: "Cost per 1M cache-write tokens in USD",
        }),
      }),
    }),
    { description: "Models available from this provider" },
  ),
});

// ─── AgentManager Interface ─────────────────────────────────

export interface IAgentManager {
  addCustomProvider(provider: CustomProviderConfig): void;
  setActiveTheme?(themeId: string): Promise<void>;
  addCustomTheme?(theme: ThemeConfig): Promise<void>;
}

// ─── Tool Definition ───────────────────────────────────────

export function createAddProviderTool(
  manager: IAgentManager,
): ToolDefinition {
  return {
    name: "add_custom_provider",
    label: "Add Custom Provider",
    description:
      "Register a custom OpenAI-compatible LLM provider. " +
      "The user provides the provider name, base URL, optional API key / headers, " +
      "and a list of models with their capabilities and cost info.",
    parameters: AddCustomProviderParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const p = params as CustomProviderConfig;
      try {
        manager.addCustomProvider(p);
        const modelNames = p.models.map((m) => m.name).join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully added provider "${p.name}" (${p.baseUrl}) with models: ${modelNames}`,
            },
          ],
          details: undefined,
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to add provider: ${String(err)}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
