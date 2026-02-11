import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type SessionStats,
  type ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import type { Model } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import type {
  SessionInfo,
  SessionDetail,
  ChatMessage,
  AssistantContentBlock,
  ThinkingLevel,
  AppConfig,
  ModelInfo,
  CustomProviderConfig,
  CustomModelConfig,
} from "@friend/shared";
import type { SSEEvent, GlobalSSEEvent } from "@friend/shared";
import { prisma, type Prisma } from "@friend/db";

// ─── DB mapping types ──────────────────────────────────────

type DbMessage = {
  id: string;
  sessionId: string;
  orderIndex: number;
  role: string;
  content: string | null;
  contentBlocks: string | null;
  toolCallId: string | null;
  toolName: string | null;
  result: string | null;
  isError: boolean | null;
  timestamp: string;
};

type DbCustomProvider = {
  name: string;
  baseUrl: string;
  apiKey: string | null;
  api: string | null;
  headers: string | null;
  models: DbCustomModel[];
};

type DbCustomModel = {
  id: string;
  modelId: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
  costInput: number;
  costOutput: number;
  costCacheRead: number;
  costCacheWrite: number;
  providerName: string;
};

// ─── DB ↔ App mapping functions ────────────────────────────

function dbMessageToChatMessage(m: DbMessage): ChatMessage {
  switch (m.role) {
    case "user":
      return {
        role: "user",
        id: m.id,
        content: m.content ?? "",
        timestamp: m.timestamp,
      };
    case "assistant":
      return {
        role: "assistant",
        id: m.id,
        content: m.contentBlocks ? JSON.parse(m.contentBlocks) : [],
        timestamp: m.timestamp,
      };
    case "tool_result":
      return {
        role: "tool_result",
        id: m.id,
        toolCallId: m.toolCallId ?? "",
        toolName: m.toolName ?? "",
        result: m.result ?? "",
        isError: m.isError ?? false,
        timestamp: m.timestamp,
      };
    default:
      throw new Error(`Unknown message role: ${m.role}`);
  }
}

function dbProviderToConfig(p: DbCustomProvider): CustomProviderConfig {
  return {
    name: p.name,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey ?? undefined,
    api: p.api ?? undefined,
    headers: p.headers ? JSON.parse(p.headers) : undefined,
    models: p.models.map((m) => ({
      id: m.modelId,
      name: m.name,
      reasoning: m.reasoning,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      cost: {
        input: m.costInput,
        output: m.costOutput,
        cacheRead: m.costCacheRead,
        cacheWrite: m.costCacheWrite,
      },
    })),
  };
}

function chatMessageToDbData(
  sessionId: string,
  msg: ChatMessage,
  orderIndex: number,
): Prisma.MessageUncheckedCreateInput {
  const base = {
    id: msg.id,
    sessionId,
    orderIndex,
    role: msg.role,
    timestamp: msg.timestamp,
  };

  switch (msg.role) {
    case "user":
      return { ...base, content: msg.content };
    case "assistant":
      return { ...base, contentBlocks: JSON.stringify(msg.content) };
    case "tool_result":
      return {
        ...base,
        toolCallId: msg.toolCallId,
        toolName: msg.toolName,
        result: msg.result,
        isError: msg.isError,
      };
  }
}

// ─── ManagedSession & EventSubscriber ──────────────────────

interface ManagedSession {
  id: string;
  name: string;
  session: AgentSession;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  currentAssistantBlocks: AssistantContentBlock[];
  currentAssistantId: string | null;
  currentToolCalls: Map<string, { toolName: string; argsJson: string }>;
  workingPath?: string;
}

interface EventSubscriber {
  push(event: GlobalSSEEvent): void;
  close(): void;
}

// ─── Custom tool: add_custom_provider ────────────────────

const AddCustomProviderParams = Type.Object({
  name: Type.String({ description: "Provider name (e.g. 'my-openai')" }),
  baseUrl: Type.String({ description: "Base URL of the OpenAI-compatible API" }),
  apiKey: Type.Optional(Type.String({ description: "API key for authentication" })),
  api: Type.Optional(
    Type.String({
      description:
        'API protocol to use. Common values: "openai-completions", "anthropic-messages". Defaults to "openai-completions".',
    }),
  ),
  headers: Type.Optional(
    Type.Record(Type.String(), Type.String(), { description: "Extra HTTP headers" }),
  ),
  models: Type.Array(
    Type.Object({
      id: Type.String({ description: "Model ID sent to the API (e.g. 'gpt-4o')" }),
      name: Type.String({ description: "Human-readable display name" }),
      reasoning: Type.Boolean({ description: "Whether the model supports extended thinking" }),
      contextWindow: Type.Number({ description: "Max context window in tokens" }),
      maxTokens: Type.Number({ description: "Max output tokens" }),
      cost: Type.Object({
        input: Type.Number({ description: "Cost per 1M input tokens in USD" }),
        output: Type.Number({ description: "Cost per 1M output tokens in USD" }),
        cacheRead: Type.Number({ description: "Cost per 1M cache-read tokens in USD" }),
        cacheWrite: Type.Number({ description: "Cost per 1M cache-write tokens in USD" }),
      }),
    }),
    { description: "Models available from this provider" },
  ),
});

function createAddProviderTool(manager: AgentManager): ToolDefinition {
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

// ─── AgentManager ──────────────────────────────────────────

class AgentManager {
  private managedSessions = new Map<string, ManagedSession>();
  private globalSubscribers = new Set<EventSubscriber>();
  private authStorage: AuthStorage;
  private modelRegistry: ModelRegistry;
  private config: AppConfig = {
    thinkingLevel: "medium",
    customProviders: [],
    activeThemeId: "default-dark",
  };

  constructor() {
    this.authStorage = new AuthStorage();
    this.modelRegistry = new ModelRegistry(this.authStorage);
  }

  async init(): Promise<void> {
    // 1. Load AppConfig
    const config = await prisma.appConfig.findFirst({ where: { id: "singleton" } });
    if (config) {
      this.config.thinkingLevel = config.thinkingLevel as ThinkingLevel;
    }

    // 2. Load CustomProviders (with models)
    const providers = await prisma.customProvider.findMany({ include: { models: true } });
    for (const p of providers) {
      const providerConfig = dbProviderToConfig(p);
      this.addCustomProvider(providerConfig, false); // skip DB write during init
    }

    // 3. Load all Sessions
    const sessions = await prisma.session.findMany({
      include: { messages: { orderBy: { orderIndex: "asc" } } },
    });
    for (const s of sessions) {
      const { session } = await createAgentSession({
        cwd: s.workingPath ?? undefined,
        sessionManager: SessionManager.inMemory(),
        authStorage: this.authStorage,
        modelRegistry: this.modelRegistry,
        thinkingLevel: this.config.thinkingLevel,
        customTools: [createAddProviderTool(this)],
      });

      const messages = s.messages.map(dbMessageToChatMessage);

      const managed: ManagedSession = {
        id: s.id,
        name: s.name,
        session,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        messages,
        currentAssistantBlocks: [],
        currentAssistantId: null,
        currentToolCalls: new Map(),
        workingPath: s.workingPath ?? undefined,
      };

      // Restore model selection
      if (s.model) {
        const slashIdx = s.model.indexOf("/");
        if (slashIdx !== -1) {
          const provider = s.model.substring(0, slashIdx);
          const modelId = s.model.substring(slashIdx + 1);
          const model = this.modelRegistry.find(provider, modelId);
          if (model) await managed.session.setModel(model);
        }
      }

      this.setupEventListeners(managed);
      this.managedSessions.set(s.id, managed);
    }

    console.log(
      `Loaded ${sessions.length} session(s), ${providers.length} custom provider(s) from database`,
    );
  }

  // Custom provider management
  addCustomProvider(provider: CustomProviderConfig, persist = true): void {
    // Remove existing with same name
    this.config.customProviders = this.config.customProviders.filter(
      (p) => p.name !== provider.name,
    );
    this.config.customProviders.push(provider);

    // Register with ModelRegistry via registerProvider
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
      prisma.customProvider
        .upsert({
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
        })
        .catch((err) => console.error("Failed to persist custom provider:", err));
    }
  }

  async removeCustomProvider(name: string): Promise<boolean> {
    const before = this.config.customProviders.length;
    this.config.customProviders = this.config.customProviders.filter((p) => p.name !== name);
    if (this.config.customProviders.length === before) return false;

    // Re-register all remaining providers (no unregister API, so refresh)
    this.modelRegistry.refresh();
    for (const p of this.config.customProviders) {
      this.addCustomProvider(p, false);
    }

    await prisma.customProvider.delete({ where: { name } }).catch(() => {});
    return true;
  }

  getCustomProviders(): CustomProviderConfig[] {
    return [...this.config.customProviders];
  }

  async listSessions(): Promise<SessionInfo[]> {
    return Array.from(this.managedSessions.values()).map((s) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      model: s.session.model ? `${s.session.model.provider}/${s.session.model.id}` : undefined,
      messageCount: s.messages.length,
      workingPath: s.workingPath,
    }));
  }

  async createSession(opts?: { name?: string; workingPath?: string }): Promise<SessionInfo> {
    const id = crypto.randomUUID();
    const name = opts?.name ?? `Session ${this.managedSessions.size + 1}`;

    const { session } = await createAgentSession({
      cwd: opts?.workingPath,
      sessionManager: SessionManager.inMemory(),
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      thinkingLevel: this.config.thinkingLevel,
      customTools: [createAddProviderTool(this)],
    });

    const now = new Date();
    const managed: ManagedSession = {
      id,
      name,
      session,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messages: [],
      currentAssistantBlocks: [],
      currentAssistantId: null,
      currentToolCalls: new Map(),
      workingPath: opts?.workingPath,
    };

    this.setupEventListeners(managed);
    this.managedSessions.set(id, managed);

    // Persist to DB
    await prisma.session.create({
      data: {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        workingPath: opts?.workingPath,
      },
    });

    return {
      id,
      name,
      createdAt: managed.createdAt,
      updatedAt: managed.updatedAt,
      model: session.model ? `${session.model.provider}/${session.model.id}` : undefined,
      messageCount: 0,
      workingPath: opts?.workingPath,
    };
  }

  async getSession(id: string): Promise<SessionDetail | null> {
    const managed = this.managedSessions.get(id);
    if (!managed) return null;
    return {
      id: managed.id,
      name: managed.name,
      createdAt: managed.createdAt,
      updatedAt: managed.updatedAt,
      model: managed.session.model
        ? `${managed.session.model.provider}/${managed.session.model.id}`
        : undefined,
      messageCount: managed.messages.length,
      messages: managed.messages,
      workingPath: managed.workingPath,
    };
  }

  async deleteSession(id: string): Promise<boolean> {
    const managed = this.managedSessions.get(id);
    if (!managed) return false;
    managed.session.dispose();
    this.managedSessions.delete(id);

    // Delete from DB (cascade deletes messages)
    await prisma.session.delete({ where: { id } }).catch(() => {});

    return true;
  }

  async prompt(id: string, message: string): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);

    // Add user message
    const userMsg: ChatMessage = {
      role: "user",
      id: crypto.randomUUID(),
      content: message,
      timestamp: new Date().toISOString(),
    };
    managed.messages.push(userMsg);
    managed.updatedAt = new Date().toISOString();

    // Persist user message
    const orderIndex = managed.messages.length - 1;
    await prisma.message.create({
      data: chatMessageToDbData(id, userMsg, orderIndex),
    });
    prisma.session.update({ where: { id }, data: { updatedAt: new Date() } }).catch(() => {});

    // Run prompt (non-blocking - returns after agent finishes)
    managed.session.prompt(message).catch((err) => {
      this.broadcast(managed, { type: "error", message: String(err) });
    });
  }

  async steer(id: string, message: string): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);
    await managed.session.steer(message);
  }

  async abort(id: string): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);
    await managed.session.abort();
  }

  async compact(id: string): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);
    await managed.session.compact();
  }

  getStats(id: string): SessionStats | null {
    const managed = this.managedSessions.get(id);
    if (!managed) return null;
    return managed.session.getSessionStats();
  }

  async getModels(): Promise<ModelInfo[]> {
    const all = this.modelRegistry.getAll();
    const available = this.modelRegistry.getAvailable();
    const availableSet = new Set(available.map((m) => `${m.provider}/${m.id}`));
    return all.map((m) => ({
      provider: m.provider,
      id: m.id,
      name: `${m.provider}/${m.id}`,
      available: availableSet.has(`${m.provider}/${m.id}`),
    }));
  }

  async setModel(sessionId: string, provider: string, modelId: string): Promise<boolean> {
    const managed = this.managedSessions.get(sessionId);
    if (!managed) return false;

    const model = this.modelRegistry.find(provider, modelId);
    if (!model) return false;

    await managed.session.setModel(model);

    // Fire-and-forget: persist model selection
    prisma.session
      .update({
        where: { id: sessionId },
        data: { model: `${provider}/${modelId}` },
      })
      .catch((err) => console.error("Failed to persist model selection:", err));

    return true;
  }

  getConfig(): AppConfig {
    return {
      thinkingLevel: this.config.thinkingLevel,
      customProviders: [...this.config.customProviders],
      activeThemeId: this.config.activeThemeId,
    };
  }

  async updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    if (updates.thinkingLevel) {
      this.config.thinkingLevel = updates.thinkingLevel;

      // Persist to DB
      await prisma.appConfig.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", thinkingLevel: updates.thinkingLevel },
        update: { thinkingLevel: updates.thinkingLevel },
      });
    }
    if (updates.activeThemeId) {
      this.config.activeThemeId = updates.activeThemeId;
    }
    return this.getConfig();
  }

  setApiKey(provider: string, apiKey: string): void {
    this.authStorage.setRuntimeApiKey(provider, apiKey);
  }

  setThinkingLevel(sessionId: string, level: ThinkingLevel): boolean {
    const managed = this.managedSessions.get(sessionId);
    if (!managed) return false;
    managed.session.setThinkingLevel(level);
    return true;
  }

  // SSE subscription
  subscribe(): EventSubscriber & AsyncIterable<GlobalSSEEvent> {
    const manager = this;

    const queue: GlobalSSEEvent[] = [];
    let resolve: ((value: IteratorResult<GlobalSSEEvent>) => void) | null = null;
    let closed = false;

    const subscriber: EventSubscriber & AsyncIterable<GlobalSSEEvent> = {
      push(event: GlobalSSEEvent) {
        if (closed) return;
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: event, done: false });
        } else {
          queue.push(event);
        }
      },
      close() {
        closed = true;
        if (resolve) {
          resolve({ value: undefined as any, done: true });
          resolve = null;
        }
      },
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<GlobalSSEEvent>> {
            if (queue.length > 0) {
              return Promise.resolve({
                value: queue.shift()!,
                done: false,
              });
            }
            if (closed) {
              return Promise.resolve({
                value: undefined as any,
                done: true,
              });
            }
            return new Promise((r) => {
              resolve = r;
            });
          },
          return(): Promise<IteratorResult<GlobalSSEEvent>> {
            closed = true;
            manager.globalSubscribers.delete(subscriber);
            return Promise.resolve({ value: undefined as any, done: true });
          },
        };
      },
    };

    this.globalSubscribers.add(subscriber);
    return subscriber;
  }

  private broadcast(managed: ManagedSession, event: SSEEvent): void {
    const globalEvent: GlobalSSEEvent = { ...event, sessionId: managed.id };
    for (const sub of this.globalSubscribers) {
      sub.push(globalEvent);
    }
  }

  private setupEventListeners(managed: ManagedSession): void {
    managed.session.subscribe((event: AgentSessionEvent) => {
      this.handleSDKEvent(managed, event);
    });
  }

  private handleSDKEvent(managed: ManagedSession, event: AgentSessionEvent): void {
    switch (event.type) {
      case "agent_start":
        this.broadcast(managed, { type: "agent_start" });
        break;

      case "agent_end":
        this.broadcast(managed, { type: "agent_end" });
        break;

      case "turn_start":
        this.broadcast(managed, { type: "turn_start" });
        break;

      case "turn_end":
        this.broadcast(managed, { type: "turn_end" });
        break;

      case "message_start": {
        // Start tracking new assistant message
        const msgId = crypto.randomUUID();
        managed.currentAssistantId = msgId;
        managed.currentAssistantBlocks = [];
        this.broadcast(managed, {
          type: "message_start",
          messageId: msgId,
          role: "assistant",
        });
        break;
      }

      case "message_update": {
        const ame = event.assistantMessageEvent;
        switch (ame.type) {
          case "text_delta":
            this.broadcast(managed, {
              type: "text_delta",
              content: ame.delta,
            });
            // Update or append text block
            this.appendToAssistantBlock(managed, "text", ame.delta);
            break;

          case "thinking_delta":
            this.broadcast(managed, {
              type: "thinking_delta",
              content: ame.delta,
            });
            this.appendToAssistantBlock(managed, "thinking", ame.delta);
            break;

          case "toolcall_start": {
            const tc = ame.partial.content[ame.contentIndex];
            const toolCallId = tc && "id" in tc ? (tc as any).id : crypto.randomUUID();
            const toolName = tc && "name" in tc ? (tc as any).name : "unknown";
            managed.currentToolCalls.set(toolCallId, {
              toolName,
              argsJson: "",
            });
            this.broadcast(managed, {
              type: "tool_call_start",
              toolCallId,
              toolName,
            });
            break;
          }

          case "toolcall_delta": {
            // Find the tool call being streamed
            const tcContent = ame.partial.content[ame.contentIndex];
            const tcId = tcContent && "id" in tcContent ? (tcContent as any).id : undefined;
            if (tcId && managed.currentToolCalls.has(tcId)) {
              const tc = managed.currentToolCalls.get(tcId)!;
              tc.argsJson += ame.delta;
            }
            this.broadcast(managed, {
              type: "tool_call_delta",
              toolCallId: tcId ?? "",
              content: ame.delta,
            });
            break;
          }

          case "toolcall_end": {
            const tcEnd = ame.toolCall;
            const toolCallId = tcEnd.id;
            const entry = managed.currentToolCalls.get(toolCallId);
            managed.currentAssistantBlocks.push({
              type: "tool_call",
              toolCallId,
              toolName: entry?.toolName ?? tcEnd.name,
              args: JSON.stringify(tcEnd.arguments),
            });
            this.broadcast(managed, {
              type: "tool_call_end",
              toolCallId,
              toolName: entry?.toolName ?? tcEnd.name,
              args: JSON.stringify(tcEnd.arguments),
            });
            break;
          }
        }
        break;
      }

      case "message_end": {
        // Finalize assistant message
        if (managed.currentAssistantId) {
          const assistantMsg: ChatMessage = {
            role: "assistant",
            id: managed.currentAssistantId,
            content: [...managed.currentAssistantBlocks],
            timestamp: new Date().toISOString(),
          };
          managed.messages.push(assistantMsg);
          managed.updatedAt = new Date().toISOString();
          this.broadcast(managed, {
            type: "message_end",
            messageId: managed.currentAssistantId,
          });

          // Fire-and-forget: persist assistant message
          const orderIndex = managed.messages.length - 1;
          prisma.message
            .create({ data: chatMessageToDbData(managed.id, assistantMsg, orderIndex) })
            .catch((err) => console.error("Failed to persist assistant message:", err));
          prisma.session
            .update({ where: { id: managed.id }, data: { updatedAt: new Date() } })
            .catch(() => {});

          managed.currentAssistantId = null;
          managed.currentAssistantBlocks = [];
          managed.currentToolCalls.clear();
        }
        break;
      }

      case "tool_execution_start":
        this.broadcast(managed, {
          type: "tool_execution_start",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        });
        break;

      case "tool_execution_update":
        this.broadcast(managed, {
          type: "tool_execution_update",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result:
            typeof event.partialResult === "string"
              ? event.partialResult
              : JSON.stringify(event.partialResult),
        });
        break;

      case "tool_execution_end": {
        const resultText =
          typeof event.result === "string" ? event.result : JSON.stringify(event.result);
        // Add tool result message
        const toolMsg: ChatMessage = {
          role: "tool_result",
          id: crypto.randomUUID(),
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result: resultText,
          isError: event.isError,
          timestamp: new Date().toISOString(),
        };
        managed.messages.push(toolMsg);

        // Fire-and-forget: persist tool result message
        const orderIndex = managed.messages.length - 1;
        prisma.message
          .create({ data: chatMessageToDbData(managed.id, toolMsg, orderIndex) })
          .catch((err) => console.error("Failed to persist tool result message:", err));

        this.broadcast(managed, {
          type: "tool_execution_end",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result: resultText,
          isError: event.isError,
        });
        break;
      }
    }
  }

  private appendToAssistantBlock(
    managed: ManagedSession,
    blockType: "text" | "thinking",
    delta: string,
  ): void {
    const blocks = managed.currentAssistantBlocks;
    const last = blocks[blocks.length - 1];
    if (last && last.type === blockType) {
      last.text += delta;
    } else {
      blocks.push({ type: blockType, text: delta });
    }
  }
}

// ─── Singleton export ──────────────────────────────────────

let _agentManager: AgentManager | null = null;

export async function initAgentManager(): Promise<AgentManager> {
  _agentManager = new AgentManager();
  await _agentManager.init();
  return _agentManager;
}

export function getAgentManager(): AgentManager {
  if (!_agentManager)
    throw new Error("AgentManager not initialized. Call initAgentManager() first.");
  return _agentManager;
}
