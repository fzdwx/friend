import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { CustomProviderConfig, CustomModelConfig } from "@friend/shared";
import type { IAgentManager } from "../managers/types.js";

// ─── Tool Parameters Schema ────────────────────────────────

const ModelUpdateSchema = Type.Object({
  id: Type.String({ description: "Model ID to update or add" }),
  name: Type.Optional(Type.String({ description: "Human-readable display name" })),
  reasoning: Type.Optional(Type.Boolean({ description: "Whether the model supports extended thinking" })),
  contextWindow: Type.Optional(Type.Number({ description: "Max context window in tokens" })),
  maxTokens: Type.Optional(Type.Number({ description: "Max output tokens" })),
  cost: Type.Optional(
    Type.Object({
      input: Type.Number({ description: "Cost per 1M input tokens in USD" }),
      output: Type.Number({ description: "Cost per 1M output tokens in USD" }),
      cacheRead: Type.Number({ description: "Cost per 1M cache-read tokens in USD" }),
      cacheWrite: Type.Number({ description: "Cost per 1M cache-write tokens in USD" }),
    }),
  ),
});

export const UpdateCustomProviderParams = Type.Object({
  name: Type.String({ description: "Name of the provider to update" }),
  baseUrl: Type.Optional(Type.String({ description: "New base URL" })),
  apiKey: Type.Optional(Type.String({ description: "New API key" })),
  api: Type.Optional(Type.String({ description: 'New API protocol (e.g. "openai-completions", "anthropic-messages")' })),
  headers: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "New HTTP headers" })),
  models: Type.Optional(Type.Array(ModelUpdateSchema, { description: "Models to update/add (partial update by model id)" })),
  removeModels: Type.Optional(Type.Array(Type.String(), { description: "Model IDs to remove from this provider" })),
});

// ─── Default model config for new models ────────────────────

const DEFAULT_MODEL_CONFIG: Omit<CustomModelConfig, "id" | "name"> = {
  reasoning: false,
  contextWindow: 128000,
  maxTokens: 4096,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

// ─── Tool Definition ───────────────────────────────────────

export function createUpdateProviderTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "update_custom_provider",
    label: "Update Custom Provider",
    description:
      "Update an existing custom LLM provider. " +
      "Can update provider-level settings (baseUrl, apiKey, api, headers) " +
      "and/or update/add/remove specific models. Only provided fields will be changed.",
    parameters: UpdateCustomProviderParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { name, baseUrl, apiKey, api, headers, models, removeModels } = params as {
        name: string;
        baseUrl?: string;
        apiKey?: string;
        api?: string;
        headers?: Record<string, string>;
        models?: Array<{
          id: string;
          name?: string;
          reasoning?: boolean;
          contextWindow?: number;
          maxTokens?: number;
          cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
        }>;
        removeModels?: string[];
      };

      try {
        // Find existing provider
        const providers = manager.getCustomProviders();
        const existing = providers.find((p) => p.name === name);

        if (!existing) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Provider "${name}" not found. Use add_custom_provider to create a new provider.`,
              },
            ],
            details: undefined,
          };
        }

        // Build updated config
        const updated: CustomProviderConfig = {
          name,
          baseUrl: baseUrl ?? existing.baseUrl,
          apiKey: apiKey ?? existing.apiKey,
          api: api ?? existing.api,
          headers: headers ?? existing.headers,
          models: [...existing.models],
        };

        // Remove models if specified
        if (removeModels && removeModels.length > 0) {
          updated.models = updated.models.filter((m) => !removeModels.includes(m.id));
        }

        // Update/add models if specified
        if (models && models.length > 0) {
          for (const modelUpdate of models) {
            const existingIdx = updated.models.findIndex((m) => m.id === modelUpdate.id);
            if (existingIdx >= 0) {
              // Update existing model
              const existingModel = updated.models[existingIdx];
              updated.models[existingIdx] = {
                id: modelUpdate.id,
                name: modelUpdate.name ?? existingModel.name,
                reasoning: modelUpdate.reasoning ?? existingModel.reasoning,
                contextWindow: modelUpdate.contextWindow ?? existingModel.contextWindow,
                maxTokens: modelUpdate.maxTokens ?? existingModel.maxTokens,
                cost: modelUpdate.cost ?? existingModel.cost,
              };
            } else {
              // Add new model
              if (!modelUpdate.name) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: `Cannot add new model "${modelUpdate.id}" without a name. Please provide the "name" field.`,
                    },
                  ],
                  details: undefined,
                };
              }
              updated.models.push({
                id: modelUpdate.id,
                name: modelUpdate.name,
                reasoning: modelUpdate.reasoning ?? DEFAULT_MODEL_CONFIG.reasoning,
                contextWindow: modelUpdate.contextWindow ?? DEFAULT_MODEL_CONFIG.contextWindow,
                maxTokens: modelUpdate.maxTokens ?? DEFAULT_MODEL_CONFIG.maxTokens,
                cost: modelUpdate.cost ?? DEFAULT_MODEL_CONFIG.cost,
              });
            }
          }
        }

        // Apply update
        manager.addCustomProvider(updated);

        // Build summary
        const changes: string[] = [];
        if (baseUrl) changes.push(`baseUrl: ${existing.baseUrl} → ${baseUrl}`);
        if (apiKey) changes.push("apiKey: updated");
        if (api) changes.push(`api: ${existing.api ?? "openai-completions"} → ${api}`);
        if (headers) changes.push("headers: updated");
        if (removeModels?.length) changes.push(`removed models: ${removeModels.join(", ")}`);
        if (models?.length) {
          const modelChanges = models.map((m: { id: string; name?: string }) => {
            const isNew = !existing.models.find((em) => em.id === m.id);
            return isNew ? `+${m.id}` : `~${m.id}`;
          });
          changes.push(`models: ${modelChanges.join(", ")}`);
        }

        const summary =
          changes.length > 0
            ? changes.map((c) => `  - ${c}`).join("\n")
            : "  (no changes)";

        return {
          content: [
            {
              type: "text" as const,
              text: `Updated provider "${name}":\n${summary}`,
            },
          ],
          details: { provider: updated },
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to update provider: ${String(err)}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
