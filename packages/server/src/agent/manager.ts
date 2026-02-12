import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type SessionStats,
} from "@mariozechner/pi-coding-agent";
import type {
  SessionInfo,
  SessionDetail,
  Message,
  ThinkingLevel,
  AppConfig,
  ModelInfo,
  CustomProviderConfig,
  ThemeConfig,
} from "@friend/shared";
import { BUILT_IN_THEMES } from "@friend/shared";
import type { SSEEvent, GlobalSSEEvent, ConfigUpdatedEvent } from "@friend/shared";
import { prisma } from "@friend/db";
import { stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createAddProviderTool,
  createGetThemesTool,
  createGenerateThemeTool,
  createSetThemeTool,
} from "./tools";
import type { IAgentManager } from "./tools";

const SESSIONS_DIR = join(homedir(), ".config", "friend", "sessions");

// ─── DB mapping types ──────────────────────────────────────

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

// ─── ManagedSession & EventSubscriber ──────────────────────

interface ManagedSession {
  id: string;
  name: string;
  session: AgentSession;
  createdAt: string;
  updatedAt: string;
  workingPath?: string;
  userMessageCount: number;
  autoRenamed?: boolean;
}

interface EventSubscriber {
  push(event: GlobalSSEEvent): void;
  close(): void;
}

// ─── AgentManager ──────────────────────────────────────────

export class AgentManager implements IAgentManager {
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
      this.config.activeThemeId = config.activeThemeId ?? "default-dark";
    }

    // 2. Load CustomProviders (with models)
    const providers = await prisma.customProvider.findMany({ include: { models: true } });
    for (const p of providers) {
      const providerConfig = dbProviderToConfig(p);
      this.addCustomProvider(providerConfig, false); // skip DB write during init
    }

    // 3. Load all Sessions
    const sessions = await prisma.session.findMany();
    for (const s of sessions) {
      let sessionManager: SessionManager;
      const cwd = s.workingPath ?? process.cwd();
      if (s.sessionFile) {
        try {
          sessionManager = SessionManager.open(s.sessionFile, SESSIONS_DIR);
        } catch (err) {
          console.warn(
            `Failed to open session file ${s.sessionFile}, falling back to inMemory:`,
            err,
          );
          sessionManager = SessionManager.inMemory(cwd);
        }
      } else {
        sessionManager = SessionManager.inMemory(cwd);
      }

      const { session } = await createAgentSession({
        cwd,
        sessionManager,
        authStorage: this.authStorage,
        modelRegistry: this.modelRegistry,
        thinkingLevel: this.config.thinkingLevel,
        customTools: [
          createAddProviderTool(this),
          createGetThemesTool(this),
          createGenerateThemeTool(this),
          createSetThemeTool(this),
        ],
      });

      const managed: ManagedSession = {
        id: s.id,
        name: s.name,
        session,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        workingPath: s.workingPath ?? undefined,
        userMessageCount: session.messages.filter((m) => m.role === "user").length,
        autoRenamed: !s.name.startsWith("Session "),
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
      messageCount: s.session.messages.length,
      workingPath: s.workingPath,
    }));
  }

  async createSession(opts?: { name?: string; workingPath?: string }): Promise<SessionInfo> {
    if (opts?.workingPath) {
      const s = await stat(opts.workingPath).catch(() => null);
      if (!s || !s.isDirectory()) {
        throw new Error(`Working path does not exist or is not a directory: ${opts.workingPath}`);
      }
    }

    const id = crypto.randomUUID();
    const name = opts?.name ?? `Session ${this.managedSessions.size + 1}`;
    const cwd = opts?.workingPath ?? process.cwd();
    const sessionManager = SessionManager.create(cwd, SESSIONS_DIR);

    const { session } = await createAgentSession({
      cwd,
      sessionManager,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      thinkingLevel: this.config.thinkingLevel,
      customTools: [
        createAddProviderTool(this),
        createGetThemesTool(this),
        createGenerateThemeTool(this),
        createSetThemeTool(this),
      ],
    });

    // Set default model if none selected
    if (!session.model) {
      const defaultModel = this.modelRegistry.getAvailable()[0];
      if (defaultModel) await session.setModel(defaultModel);
    }

    const sessionFile = sessionManager.getSessionFile() ?? null;
    const now = new Date();
    const managed: ManagedSession = {
      id,
      name,
      session,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      workingPath: opts?.workingPath,
      userMessageCount: 0,
      autoRenamed: false,
    };

    this.setupEventListeners(managed);
    this.managedSessions.set(id, managed);

    const modelStr = session.model ? `${session.model.provider}/${session.model.id}` : undefined;

    // Persist to DB
    await prisma.session.create({
      data: {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        workingPath: opts?.workingPath,
        sessionFile,
        model: modelStr,
      },
    });

    return {
      id,
      name,
      createdAt: managed.createdAt,
      updatedAt: managed.updatedAt,
      model: modelStr,
      messageCount: 0,
      workingPath: opts?.workingPath,
    };
  }

  async getSession(id: string): Promise<SessionDetail | null> {
    const managed = this.managedSessions.get(id);
    if (!managed) return null;

    const messages = managed.session.messages.filter(
      (m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
    );

    return {
      id: managed.id,
      name: managed.name,
      createdAt: managed.createdAt,
      updatedAt: managed.updatedAt,
      model: managed.session.model
        ? `${managed.session.model.provider}/${managed.session.model.id}`
        : undefined,
      messageCount: messages.length,
      messages,
      workingPath: managed.workingPath,
    };
  }

  async deleteSession(id: string): Promise<boolean> {
    const managed = this.managedSessions.get(id);
    if (!managed) return false;
    const sessionFile = managed.session.sessionManager.getSessionFile();
    managed.session.dispose();
    this.managedSessions.delete(id);

    // Delete from DB
    await prisma.session.delete({ where: { id } }).catch(() => {});
    // Clean up session file
    if (sessionFile) unlink(sessionFile).catch(() => {});

    return true;
  }

  async renameSession(id: string, name: string): Promise<boolean> {
    const managed = this.managedSessions.get(id);
    if (!managed) return false;

    managed.name = name;
    managed.updatedAt = new Date().toISOString();

    // Update DB
    await prisma.session.update({ where: { id }, data: { name } }).catch(() => {});

    return true;
  }

  private generateSessionName(userMessage: string): string {
    // 提取消息内容生成标题
    const text = userMessage.trim();
    if (text.length <= 50) {
      return text;
    }

    // 截取前 50 个字符，找到最近的单词边界
    const first50 = text.substring(0, 50);
    const lastSpace = first50.lastIndexOf(" ");
    const trunc = lastSpace > 20 ? first50.substring(0, lastSpace) : first50;

    return trunc + "...";
  }

  async prompt(id: string, message: string): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);

    managed.updatedAt = new Date().toISOString();
    prisma.session.update({ where: { id }, data: { updatedAt: new Date() } }).catch(() => {});

    // Run prompt (non-blocking - returns after agent finishes)
    // SDK session automatically tracks user + assistant messages
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
    return this.getConfig();
  }

  // ─── Theme management ──────────────────────────────────────

  async setActiveTheme(themeId: string): Promise<void> {
    this.config.activeThemeId = themeId;
    await prisma.appConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", activeThemeId: themeId },
      update: { activeThemeId: themeId },
    });
    this.broadcastGlobal({ type: "config_updated", activeThemeId: themeId });
  }

  async getCustomThemes(): Promise<ThemeConfig[]> {
    const rows = await prisma.customTheme.findMany({ orderBy: { updatedAt: "desc" } });
    return rows.map((ct) => ({
      id: ct.id,
      name: ct.name,
      mode: ct.mode as "light" | "dark" | "system",
      isPreset: false,
      isBuiltIn: false,
      colors: JSON.parse(ct.colors),
    }));
  }

  async getAllThemes(): Promise<ThemeConfig[]> {
    const custom = await this.getCustomThemes();
    return [...BUILT_IN_THEMES, ...custom];
  }

  async addCustomTheme(theme: ThemeConfig): Promise<void> {
    await prisma.customTheme.create({
      data: {
        id: theme.id,
        name: theme.name,
        mode: theme.mode,
        colors: JSON.stringify(theme.colors),
      },
    });
    this.broadcastGlobal({ type: "config_updated", addedTheme: theme });
  }

  async updateCustomTheme(
    themeId: string,
    updates: Partial<ThemeConfig>,
  ): Promise<ThemeConfig | null> {
    const existing = await prisma.customTheme.findUnique({ where: { id: themeId } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (updates.name) data.name = updates.name;
    if (updates.mode) data.mode = updates.mode;
    if (updates.colors) data.colors = JSON.stringify(updates.colors);

    await prisma.customTheme.update({ where: { id: themeId }, data });

    const updated: ThemeConfig = {
      id: existing.id,
      name: updates.name ?? existing.name,
      mode: (updates.mode ?? existing.mode) as "light" | "dark" | "system",
      isPreset: false,
      isBuiltIn: false,
      colors: updates.colors ?? JSON.parse(existing.colors),
    };
    this.broadcastGlobal({ type: "config_updated", updatedTheme: updated });
    return updated;
  }

  async deleteCustomTheme(themeId: string): Promise<boolean> {
    const existing = await prisma.customTheme.findUnique({ where: { id: themeId } });
    if (!existing) return false;
    await prisma.customTheme.delete({ where: { id: themeId } });
    // If deleted theme was active, reset to default
    if (this.config.activeThemeId === themeId) {
      this.config.activeThemeId = "default-dark";
      await prisma.appConfig.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", activeThemeId: "default-dark" },
        update: { activeThemeId: "default-dark" },
      });
    }
    this.broadcastGlobal({ type: "config_updated", deletedThemeId: themeId });
    return true;
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

    // Send synthetic agent_start for any session that is currently streaming
    // so late-joining clients (e.g. after page refresh) enter streaming mode
    for (const managed of this.managedSessions.values()) {
      if (managed.session.isStreaming) {
        subscriber.push({ type: "agent_start", sessionId: managed.id });
      }
    }

    return subscriber;
  }

  private broadcast(managed: ManagedSession, event: SSEEvent): void {
    const globalEvent: GlobalSSEEvent = { ...event, sessionId: managed.id };
    for (const sub of this.globalSubscribers) {
      sub.push(globalEvent);
    }
  }

  private broadcastGlobal(event: ConfigUpdatedEvent): void {
    const globalEvent: GlobalSSEEvent = { ...event, sessionId: "__system__" };
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
    // Track user messages for auto-rename
    if (event.type === "message_end") {
      const messages = managed.session.messages.filter((m) => m.role === "user");
      const currentCount = messages.length;

      // Check if this is a new user message (count increased)
      if (currentCount > managed.userMessageCount) {
        managed.userMessageCount = currentCount;

        // Auto-rename after 3rd user message if not already renamed
        if (currentCount === 3 && !managed.autoRenamed && managed.name.startsWith("Session ")) {
          const lastUserMessage = messages[messages.length - 1];
          this.autoRenameSession(managed, lastUserMessage);
        }
      }
    }

    // Forward SDK events directly to SSE subscribers
    this.broadcast(managed, event);
  }

  private async autoRenameSession(managed: ManagedSession, userMessage: Message): Promise<void> {
    if (userMessage.role !== "user") return;

    // Handle both string and array content formats
    let text = "";
    if (typeof userMessage.content === "string") {
      text = userMessage.content;
    } else {
      const textContent = userMessage.content.find((c: any) => c.type === "text");
      if (textContent && "text" in textContent) {
        text = textContent.text;
      }
    }

    if (!text) return;

    const newName = this.generateSessionName(text);
    if (newName === managed.name) return;

    await this.renameSession(managed.id, newName);
    managed.autoRenamed = true;

    // Broadcast rename event
    this.broadcast(managed, {
      type: "session_renamed",
      newName,
      oldName: managed.name,
    });
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
