/**
 * Provider Manager
 * 
 * Handles custom LLM provider management.
 */

import type { ModelRegistry, AuthStorage } from "@mariozechner/pi-coding-agent";
import type { CustomProviderConfig } from "@friend/shared";
import { prisma } from "@friend/db";
import type { IProviderManager, ProviderManagerDeps } from "./types.js";

export class ProviderManager implements IProviderManager {
  private customProviders: CustomProviderConfig[] = [];
  private readonly modelRegistry: ModelRegistry;
  private readonly authStorage: AuthStorage;
  private readonly deps: ProviderManagerDeps;

  constructor(
    modelRegistry: ModelRegistry,
    authStorage: AuthStorage,
    deps: ProviderManagerDeps,
  ) {
    this.modelRegistry = modelRegistry;
    this.authStorage = authStorage;
    this.deps = deps;
  }

  addCustomProvider(provider: CustomProviderConfig, persist = true): void {
    // Remove existing with same name
    this.customProviders = this.customProviders.filter(
      (p) => p.name !== provider.name,
    );
    this.customProviders.push(provider);

    // Register with ModelRegistry
    this.modelRegistry.registerProvider(provider.name, {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      api: (provider.api ?? "openai-completions") as any,
      headers: provider.headers,
      models: provider.models.map((m) => ({
        id: m.id,
        name: m.name,
        reasoning: m.reasoning,
        input: ["text" as const, "image" as const],
        cost: m.cost,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
      })),
    });

    // Set API key if provided
    if (provider.apiKey) {
      this.authStorage.setRuntimeApiKey(provider.name, provider.apiKey);
    }

    if (persist) {
      this.persistProvider(provider);
    }
  }

  private async persistProvider(provider: CustomProviderConfig): Promise<void> {
    try {
      await prisma.customProvider.upsert({
        where: { name: provider.name },
        create: {
          name: provider.name,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey ?? null,
          api: provider.api ?? null,
          headers: provider.headers ? JSON.stringify(provider.headers) : null,
          models: {
            create: provider.models.map((m) => ({
              modelId: m.id,
              name: m.name,
              reasoning: m.reasoning,
              contextWindow: m.contextWindow,
              maxTokens: m.maxTokens,
              costInput: m.cost.input,
              costOutput: m.cost.output,
              costCacheRead: m.cost.cacheRead,
              costCacheWrite: m.cost.cacheWrite,
            })),
          },
        },
        update: {
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey ?? null,
          api: provider.api ?? null,
          headers: provider.headers ? JSON.stringify(provider.headers) : null,
          models: {
            deleteMany: {},
            create: provider.models.map((m) => ({
              modelId: m.id,
              name: m.name,
              reasoning: m.reasoning,
              contextWindow: m.contextWindow,
              maxTokens: m.maxTokens,
              costInput: m.cost.input,
              costOutput: m.cost.output,
              costCacheRead: m.cost.cacheRead,
              costCacheWrite: m.cost.cacheWrite,
            })),
          },
        },
      });
    } catch (err) {
      console.error("Failed to persist custom provider:", err);
    }
  }

  async removeCustomProvider(name: string): Promise<boolean> {
    const before = this.customProviders.length;
    this.customProviders = this.customProviders.filter((p) => p.name !== name);
    if (this.customProviders.length === before) return false;

    // Re-register all remaining providers
    this.modelRegistry.refresh();
    for (const p of this.customProviders) {
      this.addCustomProvider(p, false);
    }

    await prisma.customProvider.delete({ where: { name } }).catch(() => {});
    return true;
  }

  listCustomProviders(): CustomProviderConfig[] {
    return [...this.customProviders];
  }

  updateCustomProvider(name: string, updates: Partial<CustomProviderConfig>): boolean {
    const existing = this.customProviders.find((p) => p.name === name);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    this.addCustomProvider(updated);
    return true;
  }

  getProviderModels(): { provider: string; models: string[] }[] {
    return this.customProviders.map((p) => ({
      provider: p.name,
      models: p.models.map((m) => m.id),
    }));
  }

  /**
   * Load providers from database (called during init)
   */
  loadFromDatabase(providers: CustomProviderConfig[]): void {
    this.customProviders = [];
    for (const p of providers) {
      this.addCustomProvider(p, false);
    }
  }

  /**
   * Get raw providers array (for config serialization)
   */
  getProviders(): CustomProviderConfig[] {
    return this.customProviders;
  }
}
