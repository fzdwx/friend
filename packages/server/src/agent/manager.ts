import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  DefaultResourceLoader,
  loadSkillsFromDir,
  type AgentSession,
  type AgentSessionEvent,
  type SessionStats,
  type Skill,
  type SlashCommandInfo,
} from "@mariozechner/pi-coding-agent";
import {completeSimple, Model} from "@mariozechner/pi-ai";
import type {
  SessionInfo,
  SessionDetail,
  Message,
  ThinkingLevel,
  AppConfig,
  ModelInfo,
  CustomProviderConfig,
  ThemeConfig,
  PlanModeState,
  PendingQuestion,
} from "@friend/shared";
import { BUILT_IN_THEMES, DEFAULT_AGENT_ID } from "@friend/shared";
import type { SSEEvent, GlobalSSEEvent, ConfigUpdatedEvent, SessionCreatedEvent, PlanModeStateChangedEvent, PlanModeRequestChoiceEvent, TodoItem as SharedTodoItem } from "@friend/shared";
import { prisma } from "@friend/db";
import { stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  createAddProviderTool,
  createListProvidersTool,
  createUpdateProviderTool,
  createGetThemesTool,
  createGenerateThemeTool,
  createSetThemeTool,
  createGrepTool,
  createGlobTool,
  createRenameSessionTool,
  createGetSessionTool,
  createCreateSessionTool,
  createSessionSearchTool,
  createMemorySearchTool,
  createMemoryGetTool,
  createQuestionTool,
  createCronTool,
} from "./tools";
import type { IAgentManager, ICronManager } from "./tools";
import { HeartbeatService, type HeartbeatServiceDeps } from "./heartbeat/index.js";
import { CronService, type CronServiceDeps, type CronSchedule, type CronJobInfo } from "./cron/index.js";
import { SystemEventQueue, globalSystemEventQueue } from "./system-events.js";
import { GLOBAL_SKILLS_DIR, SkillWatcher, ensureSkillsDir } from "./skills.js";
import { ensureAgentWorkspace } from "./bootstrap.js";
import { loadAgentBootstrapFiles, buildWorkspacePrompt } from "./context.js";
import {
  listAgents,
  getAgent,
  getDefaultAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  resolveAgentConfig,
  resolveAgentWorkspaceDir,
  resolveAgentSessionsDir,
  resolveAgentSkillsDir,
  ensureDefaultAgent,
  type AgentConfig,
  type ResolvedAgentConfig,
} from "./agent-manager.js";
import {
  shouldRunMemoryFlush,
  DEFAULT_MEMORY_FLUSH_PROMPT,
  SILENT_REPLY_TOKEN,
} from "./memory-flush.js";
import {
  createPlanModeExtension,
  type TodoItem,
  extractTodoItems,
  markCompletedSteps,
  isAssistantMessage,
  getTextContent,
  PLAN_MODE_TOOLS,
  NORMAL_MODE_TOOLS,
} from "./extensions/plan-mode.js";
import { createCommandsExtension } from "./extensions/commands.js";

// Sub-managers (modular refactoring)
import {
  ProviderManager,
  ThemeManager,
  CronManager,
  PlanModeManager,
  QuestionManager,
} from "./managers/index.js";
import type { ManagedSession, EventSubscriber } from "./managers/index.js";

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

// ─── AgentManager ──────────────────────────────────────────

export class AgentManager implements IAgentManager {
  private managedSessions = new Map<string, ManagedSession>();
  private globalSubscribers = new Set<EventSubscriber>();
  private readonly authStorage: AuthStorage;
  private readonly modelRegistry: ModelRegistry;
  private skillWatcher: SkillWatcher | null = null;
  private heartbeatService: HeartbeatService | null = null;
  private cronService: CronService | null = null;
  private systemEventQueue: SystemEventQueue = globalSystemEventQueue;
  private config: AppConfig = {
    thinkingLevel: "medium",
    customProviders: [],
    activeThemeId: "default-dark",
    embedding: undefined,
  };

  // Sub-managers
  private providerManager: ProviderManager;
  private themeManager: ThemeManager;
  private cronManager: CronManager;
  private planModeManager: PlanModeManager;
  private questionManager: QuestionManager;

  constructor() {
    this.authStorage = new AuthStorage();
    this.modelRegistry = new ModelRegistry(this.authStorage);

    // Initialize sub-managers with dependency injection
    // ProviderManager needs modelRegistry and authStorage
    this.providerManager = new ProviderManager(
      this.modelRegistry,
      this.authStorage,
      {
        getManagedSessions: () => this.managedSessions,
        broadcastGlobal: (event) => this.broadcastGlobal(event),
      },
    );

    // ThemeManager needs getter/setter for activeThemeId
    this.themeManager = new ThemeManager({
      getActiveThemeId: () => this.config.activeThemeId,
      setActiveThemeId: (id) => { this.config.activeThemeId = id; },
      broadcastGlobal: (event) => this.broadcastGlobal(event),
    });

    // CronManager will be initialized after cronService is created
    this.cronManager = new CronManager(null);

    // PlanModeManager needs session access
    this.planModeManager = new PlanModeManager({
      getManagedSession: (id) => this.managedSessions.get(id)!,
      broadcast: (managed, event) => this.broadcast(managed as any, event),
      saveState: (sessionId, state) => this.savePlanModeState(sessionId, state),
    });

    // QuestionManager needs session access
    this.questionManager = new QuestionManager({
      getManagedSession: (id) => this.managedSessions.get(id)!,
      broadcast: (managed, event) => this.broadcast(managed as any, event),
      savePendingQuestion: (sessionId, question) => this.savePendingQuestion(sessionId, question),
      clearPendingQuestion: (sessionId) => this.clearPendingQuestion(sessionId),
      resolveDbSessionId: (sdkSessionId) => this.sdkToDbSessionId.get(sdkSessionId),
    });
  }

  // ─── Plan Mode State Management ────────────────────────────────────────

  private planModeStates = new Map<string, PlanModeState>();
  // Map SDK sessionId (from SessionManager) to DB sessionId
  private sdkToDbSessionId = new Map<string, string>();

  // ─── Question Tool Management ──────────────────────────────────────────

  private pendingQuestions = new Map<string, {
    resolve: (value: { questionId: string; answers: any[]; cancelled: boolean }) => void;
    questionId: string;
    questions: any[];
  }>();

  private getPlanModeState(sessionId: string): PlanModeState {
    return this.planModeStates.get(sessionId) ?? { enabled: false, executing: false, modifying: false, todos: [] };
  }

  private setPlanModeState(sessionId: string, state: PlanModeState): void {
    this.planModeStates.set(sessionId, state);
    // Update ManagedSession if it exists
    const managed = this.managedSessions.get(sessionId);
    if (managed) {
      managed.planModeState = state;
    }
    // Broadcast state change
    this.broadcastPlanModeState(sessionId, state);
    // Persist to database (fire-and-forget)
    this.savePlanModeState(sessionId, state).catch(err => {
      console.error(`[AgentManager] Failed to persist planModeState:`, err);
    });
  }

  // ─── State Persistence Helpers ─────────────────────────────────────────

  /**
   * Persist plan mode state to database.
   * Called whenever plan state changes.
   */
  private async savePlanModeState(sessionId: string, state: PlanModeState): Promise<void> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          planModeState: JSON.stringify(state),
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error(`[AgentManager] Failed to save planModeState for session ${sessionId}:`, err);
    }
  }

  /**
   * Persist pending question to database.
   * Called when agent asks a question.
   */
  private async savePendingQuestion(sessionId: string, question: PendingQuestion): Promise<void> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          pendingQuestion: JSON.stringify(question),
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error(`[AgentManager] Failed to save pendingQuestion for session ${sessionId}:`, err);
    }
  }

  /**
   * Clear pending question from database.
   * Called when user answers or cancels the question.
   */
  private async clearPendingQuestion(sessionId: string): Promise<void> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          pendingQuestion: null,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error(`[AgentManager] Failed to clear pendingQuestion for session ${sessionId}:`, err);
    }
  }

  // Register SDK sessionId to DB sessionId mapping
  registerSdkSessionId(sdkSessionId: string, dbSessionId: string): void {
    this.sdkToDbSessionId.set(sdkSessionId, dbSessionId);
  }

  // Resolve DB sessionId from SDK sessionId
  resolveDbSessionId(sdkSessionId: string): string | undefined {
    return this.sdkToDbSessionId.get(sdkSessionId);
  }

  private broadcastPlanModeState(sessionId: string, state: PlanModeState): void {
    const managed = this.managedSessions.get(sessionId);
    if (!managed) return;
    
    this.broadcast(managed, {
      type: "plan_mode_state_changed",
      enabled: state.enabled,
      executing: state.executing,
      modifying: state.modifying,
      todos: state.todos,
    });
  }

  private handlePlanReady(sessionId: string, todos: TodoItem[]): void {
    const managed = this.managedSessions.get(sessionId);
    if (!managed) return;

    // Broadcast plan ready event to frontend
    this.broadcast(managed, {
      type: "plan_mode_request_choice",
      todos,
    });
  }

  private handlePlanProgress(sessionId: string, todos: TodoItem[]): void {
    const managed = this.managedSessions.get(sessionId);
    if (!managed) return;

    const completed = todos.filter(t => t.completed).length;
    this.broadcast(managed, {
      type: "plan_mode_progress",
      completed,
      total: todos.length,
    });
  }

  private handlePlanComplete(sessionId: string, todos: TodoItem[]): void {
    const managed = this.managedSessions.get(sessionId);
    if (!managed) return;

    // Broadcast completion event to frontend
    this.broadcast(managed, {
      type: "plan_mode_complete",
      todos,
    });
  }

  private async createAgentSessionWithSkills(
    cwd: string,
    sessionManager: SessionManager,
    agentId: string = DEFAULT_AGENT_ID,
    dbSessionId?: string,  // Optional DB session ID for SDK->DB mapping
  ): Promise<{ session: AgentSession; resourceLoader: DefaultResourceLoader }> {
    // Resolve agent configuration from database
    const resolvedConfig = await resolveAgentConfig(agentId);
    const agentWorkspace = resolveAgentWorkspaceDir(agentId);

    // Define custom tools early so the extension closure can access them
    const customToolsList = [
      createAddProviderTool(this),
      createListProvidersTool(this),
      createUpdateProviderTool(this),
      createGetThemesTool(this),
      createGenerateThemeTool(this),
      createSetThemeTool(this),
      createGrepTool(),
      createGlobTool(),
      createRenameSessionTool(this),
      createGetSessionTool(this),
      createCreateSessionTool(this, agentId),
      createSessionSearchTool(this),
      // Memory tools for semantic search and recall
      // Note: API keys are fetched lazily when the tool is first used
      createMemorySearchTool(agentWorkspace, {
        agentId,
        getOpenaiApiKey: () => this.authStorage.getApiKey("openai"),
        getGeminiApiKey: () => this.authStorage.getApiKey("google"),
        getVoyageApiKey: () => this.authStorage.getApiKey("voyage"),
      }),
      createMemoryGetTool(agentWorkspace, { agentId }),
      // Question tool for asking user questions
      createQuestionTool(this),
      // Cron tool for scheduling tasks
      createCronTool(this, agentId),
    ];

    const resourceLoader = new DefaultResourceLoader({
      cwd,
      noSkills: true,
      noExtensions: true,
      noPromptTemplates: true,
      noThemes: true,
      skillsOverride: () => {
        // Load global skills
        const globalResult = loadSkillsFromDir({ dir: GLOBAL_SKILLS_DIR, source: "user" });
        
        // Load agent-specific skills
        const agentSkillsDir = resolveAgentSkillsDir(agentId);
        const agentResult = loadSkillsFromDir({ dir: agentSkillsDir, source: "agent" });

        const skillMap = new Map<string, Skill>();
        for (const s of globalResult.skills) skillMap.set(s.name, s);
        for (const s of agentResult.skills) skillMap.set(s.name, s);

        return {
          skills: Array.from(skillMap.values()),
          diagnostics: [...globalResult.diagnostics, ...agentResult.diagnostics],
        };
      },
      // Inject full context via before_agent_start on first message only
      extensionFactories: [
        (pi) => {
          pi.on("before_agent_start", async (_event, ctx) => {
            // Check if context already injected
            const entries = ctx.sessionManager.getEntries();
            const hasContext = entries.some(
              (e) =>
                e.type === "message" &&
                e.message.role === "user" &&
                (e.message as any).customType === "friend_context"
            );
            if (hasContext) return; // Already injected, skip

            // Reload files fresh each turn (ensures latest content)
            const freshFiles = await loadAgentBootstrapFiles(agentWorkspace);

            // Get loaded skills summaries
            const { skills } = resourceLoader.getSkills();
            const skillSummaries = skills.map(s => ({
              name: s.name,
              description: s.description,
            }));

            // Get custom tools summaries
            const toolSummaries = customToolsList.map(t => ({
              name: t.name,
              description: t.description,
            }));

            // First message - inject full workspace context
            const systemPrompt = buildWorkspacePrompt(
              cwd,
              freshFiles,
              resolvedConfig.identity,
              agentWorkspace,
              true,           // includeMemoryRecall
              skillSummaries,  // skills
              toolSummaries,   // tools
            );
            return {
              message: {
                customType: "friend_context",
                content: systemPrompt,
                display: false,
              },
            };
          });
        },
        // Plan mode extension - handles /plan command and plan execution tracking
        createPlanModeExtension({
          // Get current plan mode state (using SDK sessionId, internally maps to DB sessionId)
          getState: (sdkSessionId: string) => {
            const dbSessionId = this.resolveDbSessionId(sdkSessionId);
            return dbSessionId ? this.getPlanModeState(dbSessionId) : { enabled: false, executing: false, modifying: false, todos: [] };
          },
          // Set plan mode state (using SDK sessionId, internally maps to DB sessionId)
          setState: (sdkSessionId: string, state: PlanModeState) => {
            const dbSessionId = this.resolveDbSessionId(sdkSessionId);
            if (dbSessionId) {
              this.setPlanModeState(dbSessionId, state);
            }
          },
          // Plan ready - notify frontend
          onPlanReady: (sdkSessionId: string, todos: TodoItem[]) => {
            const dbSessionId = this.resolveDbSessionId(sdkSessionId);
            if (dbSessionId) this.handlePlanReady(dbSessionId, todos);
          },
          // Progress update
          onProgress: (sdkSessionId: string, todos: TodoItem[]) => {
            const dbSessionId = this.resolveDbSessionId(sdkSessionId);
            if (dbSessionId) this.handlePlanProgress(dbSessionId, todos);
          },
          // All tasks completed
          onComplete: (sdkSessionId: string, todos: TodoItem[]) => {
            const dbSessionId = this.resolveDbSessionId(sdkSessionId);
            if (dbSessionId) this.handlePlanComplete(dbSessionId, todos);
          },
          // Continue with next task
          onContinue: async (sdkSessionId: string, nextTask: TodoItem) => {
            const dbSessionId = this.resolveDbSessionId(sdkSessionId);
            if (!dbSessionId) return;

            const managed = this.managedSessions.get(dbSessionId);
            if (!managed) return;

            // Use setTimeout to avoid blocking the agent_end handler
            setTimeout(async () => {
              try {
                await managed.session.prompt(`Continue with: ${nextTask.text}`);
              } catch (err: any) {
                console.error('[PlanMode] Failed to continue with next task:', err);
                // Stop execution on error (e.g. context overflow)
                this.setPlanModeState(dbSessionId, {
                  ...this.getPlanModeState(dbSessionId),
                  executing: false,
                });
                this.broadcast(managed, {
                  type: "error",
                  message: `Plan execution stopped: ${err.message || String(err)}`,
                });
              }
            }, 100);
          },
        }),
        // Custom slash commands extension
        createCommandsExtension(this, {
          onCommandResult: (sessionId: string, command: string, success: boolean, message?: string) => {
            const managed = this.managedSessions.get(sessionId);
            if (managed) {
              this.broadcast(managed, {
                type: "command_result",
                command,
                success,
                message,
              });
            }
          },
        }),
      ],
    });
    await resourceLoader.reload();

    const result = await createAgentSession({
      cwd,
      sessionManager,
      resourceLoader,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      thinkingLevel: resolvedConfig.thinkingLevel,
      customTools: customToolsList,
    });

    const { session, extensionsResult } = result;

    // Register SDK sessionId -> DB sessionId mapping (if DB sessionId provided)
    if (dbSessionId) {
      const sdkSessionId = session.sessionManager.getSessionId();
      this.registerSdkSessionId(sdkSessionId, dbSessionId);
    }

    // Bind UI context for Web app - forwards notify() calls to frontend
    session.bindExtensions({
      uiContext: {
        notify: (message: string, type?: "info" | "warning" | "error") => {
          const sdkSessionId = sessionManager.getSessionId();
          const resolvedDbSessionId = this.resolveDbSessionId(sdkSessionId) ?? dbSessionId;
          if (resolvedDbSessionId) {
            const managed = this.managedSessions.get(resolvedDbSessionId);
            if (managed) {
              this.broadcast(managed, {
                type: "notification",
                message,
                notificationType: type ?? "info",
              });
            }
          }
        },
        // Stub implementations for other UI methods (not used in Web)
        select: async () => undefined,
        confirm: async () => false,
        input: async () => undefined,
        setStatus: () => {},
        setWorkingMessage: () => {},
        setWidget: () => {},
        setFooter: () => {},
        setHeader: () => {},
        setTitle: () => {},
        onTerminalInput: () => () => {},
        getToolsExpanded: () => false,
        setToolsExpanded: () => {},
        custom: async () => undefined as any,
        pasteToEditor: () => {},
        setEditorText: () => {},
        getEditorText: () => "",
        editor: async () => undefined,
        setEditorComponent: () => {},
        get theme() { return {} as any; },
        getAllThemes: () => [],
        getTheme: () => undefined,
        setTheme: () => ({ success: false }),
      },
    });

    // Debug: log extension errors if any
    if (extensionsResult.errors.length > 0) {
      console.error('[PlanMode] Extension errors:', extensionsResult.errors);
    }

    return { session, resourceLoader };
  }

  async init(): Promise<void> {
    // 1. Ensure default agent exists
    await ensureDefaultAgent();
    const defaultAgent = await getDefaultAgent();
    
    // 2. Load AppConfig
    const config = await prisma.appConfig.findFirst({ where: { id: "singleton" } });
    if (config) {
      this.config.thinkingLevel = config.thinkingLevel as ThinkingLevel;
      this.config.activeThemeId = config.activeThemeId ?? "default-dark";
    }

    // 3. Load CustomProviders (with models)
    const providers = await prisma.customProvider.findMany({ include: { models: true } });
    for (const p of providers) {
      const providerConfig = dbProviderToConfig(p);
      this.addCustomProvider(providerConfig, false); // skip DB write during init
    }

    // 4. Load all Sessions
    const sessions = await prisma.session.findMany();
    for (const s of sessions) {
      let sessionManager: SessionManager;
      const cwd = s.workingPath ?? process.cwd();
      const agentId = s.agentId ?? defaultAgent.id;

      // Ensure agent workspace exists
      const agentWorkspace = resolveAgentWorkspaceDir(agentId);
      await ensureAgentWorkspace(agentWorkspace);

      if (s.sessionFile) {
        try {
          // Session files are now stored in agent-specific directories
          const agentSessionsDir = resolveAgentSessionsDir(agentId);
          sessionManager = SessionManager.open(s.sessionFile, agentSessionsDir);
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

      const { session, resourceLoader } = await this.createAgentSessionWithSkills(
        cwd,
        sessionManager,
        agentId,
        s.id,  // Pass DB session ID for SDK->DB mapping
      );

      const managed: ManagedSession = {
        id: s.id,
        name: s.name,
        agentId,
        session,
        resourceLoader,
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

      // Restore plan mode state from database
      if (s.planModeState) {
        try {
          const restoredState = JSON.parse(s.planModeState) as PlanModeState;
          if (restoredState.enabled || restoredState.executing) {
            this.planModeStates.set(s.id, restoredState);
            managed.planModeState = restoredState;
            console.log(`[AgentManager] Restored planModeState for session ${s.id}`);
          }
        } catch (err) {
          console.error(`[AgentManager] Failed to restore planModeState:`, err);
        }
      }

      // Restore pending question from database
      if (s.pendingQuestion) {
        try {
          const restoredQuestion = JSON.parse(s.pendingQuestion) as PendingQuestion;
          // Re-create the Promise that will be resolved when user answers
          const questionPromise = new Promise<{ questionId: string; answers: any[]; cancelled: boolean }>((resolve) => {
            this.pendingQuestions.set(s.id, {
              resolve,
              questionId: restoredQuestion.questionId,
              questions: restoredQuestion.questions,
            });
          });
          console.log(`[AgentManager] Restored pendingQuestion for session ${s.id}`);
          // Note: The promise is stored but we don't await it here
          // The agent will continue waiting for user input
        } catch (err) {
          console.error(`[AgentManager] Failed to restore pendingQuestion:`, err);
        }
      }

      this.setupEventListeners(managed);
      this.managedSessions.set(s.id, managed);
    }

    console.log(
      `Loaded ${sessions.length} session(s), ${providers.length} custom provider(s) from database`,
    );

    // 5. Initialize SkillWatcher
    await ensureSkillsDir(GLOBAL_SKILLS_DIR);

    // Get all agent IDs for skill watching
    const allAgents = await listAgents();
    const agentIds = allAgents.map((a) => a.id);

    this.skillWatcher = new SkillWatcher((affectedAgentId) => {
      if (affectedAgentId) {
        // Only reload sessions using this agent
        for (const managed of this.managedSessions.values()) {
          if (managed.agentId === affectedAgentId) {
            managed.resourceLoader.reload().catch(console.error);
          }
        }
      } else {
        // Global change - reload all sessions
        for (const managed of this.managedSessions.values()) {
          managed.resourceLoader.reload().catch(console.error);
        }
      }
    });
    this.skillWatcher.start(agentIds);

    // 6. Initialize Heartbeat and Cron services
    this.initHeartbeatAndCron();
  }

  // ─── Heartbeat and Cron Services ───────────────────────────────────────

  private initHeartbeatAndCron(): void {
    // Initialize HeartbeatService
    const heartbeatDeps: HeartbeatServiceDeps = {
      getAgents: async () => {
        const agents = await listAgents();
        return agents;
      },
      getAgentWorkspace: (agentId: string) => resolveAgentWorkspaceDir(agentId),
      executeAgentTask: async (agentId: string, prompt: string) => {
        const result = await this.executeAgentTask(agentId, prompt);
        return result;
      },
      broadcastEvent: (event) => {
        this.broadcastGlobal(event as unknown as ConfigUpdatedEvent);
      },
      getCronJobs: async (agentId: string) => {
        if (!this.cronService) return [];
        const jobs = await this.cronService.listJobs({ agentId, includeDisabled: true });
        return jobs.map(j => ({
          name: j.name,
          enabled: j.enabled,
          lastStatus: j.lastStatus,
          lastRunAt: j.lastRunAt?.toLocaleString(),
        }));
      },
    };
    this.heartbeatService = new HeartbeatService(heartbeatDeps);
    this.heartbeatService.start();

    // Initialize CronService
    const cronDeps: CronServiceDeps = {
      getAgentSession: async (agentId: string) => {
        return this.getOrCreateSessionForAgent(agentId);
      },
      createAgentSession: async (agentId: string) => {
        return this.createSessionForAgent(agentId);
      },
      enqueueSystemEvent: (agentId: string, text: string) => {
        this.systemEventQueue.enqueue(agentId, text);
      },
      broadcastEvent: (event) => {
        this.broadcastGlobal(event as unknown as ConfigUpdatedEvent);
      },
    };
    this.cronService = new CronService(cronDeps);
    this.cronService.start();

    // Update cronManager with the initialized service
    this.cronManager = new CronManager(this.cronService);

    console.log("[AgentManager] Heartbeat and Cron services started");
  }

  private async executeAgentTask(agentId: string, promptText: string): Promise<string> {
    const managed = await this.getOrCreateSessionForAgent(agentId);
    const agent = managed.session.agent;

    // Collect the last assistant message when agent finishes
    let lastAssistantText = "";
    const unsubscribe = agent.subscribe((event) => {
      if (event.type === "agent_end") {
        // Find the last assistant message
        const messages = event.messages;
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.role === "assistant" && msg.content) {
            // Extract text from content
            if (typeof msg.content === "string") {
              lastAssistantText = msg.content;
            } else if (Array.isArray(msg.content)) {
              lastAssistantText = msg.content
                .filter((c): c is { type: "text"; text: string } => c.type === "text")
                .map((c) => c.text)
                .join("");
            }
            break;
          }
        }
      }
    });

    try {
      // Send the prompt
      await managed.session.prompt(promptText);
      // Wait for agent to complete
      await agent.waitForIdle();
      return lastAssistantText || "Task executed (no response)";
    } finally {
      unsubscribe();
    }
  }

  private async getOrCreateSessionForAgent(agentId: string): Promise<{
    id: string;
    session: AgentSession;
    prompt: (msg: string) => Promise<void>;
  }> {
    // Find the most recent session for this agent
    let managed: ManagedSession | undefined;
    let newestTime = 0;
    
    for (const session of this.managedSessions.values()) {
      if (session.agentId === agentId) {
        const updatedAt = new Date(session.updatedAt).getTime();
        if (updatedAt > newestTime) {
          newestTime = updatedAt;
          managed = session;
        }
      }
    }

    if (managed) {
      return {
        id: managed.id,
        session: managed.session,
        prompt: (msg: string) => this.prompt(managed!.id, msg),
      };
    }

    // Create a new session for this agent
    return this.createSessionForAgent(agentId);
  }

  private async createSessionForAgent(agentId: string): Promise<{
    id: string;
    session: AgentSession;
    prompt: (msg: string) => Promise<void>;
  }> {
    const session = await this.createSession({ agentId });
    const managed = this.managedSessions.get(session.id);
    if (!managed) {
      throw new Error(`Failed to create session for agent ${agentId}`);
    }
    return {
      id: session.id,
      session: managed.session,
      prompt: (msg: string) => this.prompt(session.id, msg),
    };
  }

  // Custom provider management (delegated to ProviderManager)
  addCustomProvider(provider: CustomProviderConfig, persist = true): void {
    this.providerManager.addCustomProvider(provider, persist);
    // Update config for backward compatibility
    this.config.customProviders = this.providerManager.listCustomProviders();
  }

  async removeCustomProvider(name: string): Promise<boolean> {
    const result = await this.providerManager.removeCustomProvider(name);
    // Update config for backward compatibility
    this.config.customProviders = this.providerManager.listCustomProviders();
    return result;
  }

  getCustomProviders(): CustomProviderConfig[] {
    return this.providerManager.listCustomProviders();
  }

  // ─── Skill management ──────────────────────────────────────

  /**
   * Get all loaded skills.
   * If sessionId is provided, returns skills for that session only.
   * Otherwise, returns all unique skills from all sessions (deduplicated by filePath).
   */
  getAllSkills(sessionId?: string): Skill[] {
    if (sessionId) {
      const managed = this.managedSessions.get(sessionId);
      if (managed) {
        return managed.resourceLoader.getSkills().skills;
      }
      return [];
    }

    // Collect all unique skills from all sessions, deduplicated by filePath
    const skillMap = new Map<string, Skill>();

    for (const managed of this.managedSessions.values()) {
      const { skills } = managed.resourceLoader.getSkills();
      for (const skill of skills) {
        if (!skillMap.has(skill.filePath)) {
          skillMap.set(skill.filePath, skill);
        }
      }
    }

    // Also include global skills in case no session has loaded them yet
    const globalResult = loadSkillsFromDir({ dir: GLOBAL_SKILLS_DIR, source: "user" });
    for (const skill of globalResult.skills) {
      if (!skillMap.has(skill.filePath)) {
        skillMap.set(skill.filePath, skill);
      }
    }

    return Array.from(skillMap.values());
  }

  // Alias for backward compatibility
  getSkills(sessionId?: string): Skill[] {
    return this.getAllSkills(sessionId);
  }

  /**
   * Get skill directory paths.
   * Returns global skills directory + all agent skills directories.
   */
  getSkillPaths(): {
    global: string;
    agents: Array<{ agentId: string; path: string }>;
  } {
    // Get all agents from database (async, but we need sync)
    // For now, return paths from loaded sessions + cache
    const agents: Array<{ agentId: string; path: string }> = [];

    // Use cached agent list if available
    for (const agentId of this.cachedAgentIds) {
      agents.push({
        agentId,
        path: resolveAgentSkillsDir(agentId),
      });
    }

    return {
      global: GLOBAL_SKILLS_DIR,
      agents,
    };
  }

  private cachedAgentIds: string[] = [];

  private async refreshCachedAgents(): Promise<void> {
    const allAgents = await listAgents();
    this.cachedAgentIds = allAgents.map((a) => a.id);
  }

  /**
   * Reload skills for a session or all sessions.
   */
  async reloadSkills(sessionId?: string): Promise<void> {
    if (sessionId) {
      const managed = this.managedSessions.get(sessionId);
      if (managed) {
        await managed.resourceLoader.reload();
      }
    } else {
      // Reload all sessions
      for (const managed of this.managedSessions.values()) {
        await managed.resourceLoader.reload();
      }
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    return Array.from(this.managedSessions.values()).map((s) => ({
      id: s.id,
      name: s.name,
      agentId: s.agentId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      model: s.session.model ? `${s.session.model.provider}/${s.session.model.id}` : undefined,
      messageCount: s.session.messages.length,
      workingPath: s.workingPath,
    }));
  }

  async createSession(opts?: { 
    name?: string; 
    workingPath?: string;
    agentId?: string;
  }): Promise<SessionInfo> {
    if (opts?.workingPath) {
      const s = await stat(opts.workingPath).catch(() => null);
      if (!s || !s.isDirectory()) {
        throw new Error(`Working path does not exist or is not a directory: ${opts.workingPath}`);
      }
    }

    const id = crypto.randomUUID();
    const name = opts?.name ?? `Session ${this.managedSessions.size + 1}`;
    const cwd = opts?.workingPath ?? process.cwd();
    
    // Use specified agent or default
    const agentId = opts?.agentId ?? DEFAULT_AGENT_ID;
    
    // Ensure agent workspace exists
    const agentWorkspace = resolveAgentWorkspaceDir(agentId);
    await ensureAgentWorkspace(agentWorkspace);

    // Create session file in agent-specific directory
    const agentSessionsDir = resolveAgentSessionsDir(agentId);
    const sessionManager = SessionManager.create(cwd, agentSessionsDir);

    const { session, resourceLoader } = await this.createAgentSessionWithSkills(
      cwd,
      sessionManager,
      agentId,
      id,  // Pass DB session ID for SDK->DB mapping
    );

    // Set default model from agent config if none selected
    if (!session.model) {
      const resolvedConfig = await resolveAgentConfig(agentId);
      
      // Try to set model from agent config
      if (resolvedConfig.model) {
        const slashIdx = resolvedConfig.model.indexOf("/");
        if (slashIdx !== -1) {
          const provider = resolvedConfig.model.substring(0, slashIdx);
          const modelId = resolvedConfig.model.substring(slashIdx + 1);
          const model = this.modelRegistry.find(provider, modelId);
          if (model) await session.setModel(model);
        }
      }
      
      // Fallback to first available model
      if (!session.model) {
        const defaultModel = this.modelRegistry.getAvailable()[0];
        if (defaultModel) await session.setModel(defaultModel);
      }
    }

    const sessionFile = sessionManager.getSessionFile() ?? null;
    const now = new Date();
    const managed: ManagedSession = {
      id,
      name,
      agentId,
      session,
      resourceLoader,
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
        agentId,  // Store agent binding
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
      agentId,
      createdAt: managed.createdAt,
      updatedAt: managed.updatedAt,
      model: modelStr,
      messageCount: 0,
      workingPath: opts?.workingPath,
    };
  }

  /**
   * Create a new session with a specific agent.
   * Used by the create_session tool to create sessions programmatically.
   * Broadcasts session_created event to update frontend UI.
   */
  async createSessionWithAgent(
    agentId: string,
    opts?: { name?: string; workingPath?: string },
  ): Promise<{ id: string; name: string; agentId: string; workingPath?: string }> {
    const sessionInfo = await this.createSession({
      ...opts,
      agentId,
    });

    // Broadcast session_created event to update frontend
    this.broadcastGlobal({
      type: "session_created",
      newSessionId: sessionInfo.id,
      agentId: sessionInfo.agentId!,
      name: sessionInfo.name,
      workingPath: sessionInfo.workingPath,
    });

    return {
      id: sessionInfo.id,
      name: sessionInfo.name,
      agentId: sessionInfo.agentId!,
      workingPath: sessionInfo.workingPath,
    };
  }

  async getSession(id: string): Promise<SessionDetail | null> {
    const managed = this.managedSessions.get(id);
    if (!managed) return null;

    const messages = managed.session.messages.filter(
      (m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
    );

    // Get plan mode state for this session
    const planModeState = this.getPlanModeState(id);

    // Get pending question for this session
    const pendingQuestion = this.pendingQuestions.get(id);

    return {
      id: managed.id,
      name: managed.name,
      agentId: managed.agentId,
      createdAt: managed.createdAt,
      updatedAt: managed.updatedAt,
      model: managed.session.model
        ? `${managed.session.model.provider}/${managed.session.model.id}`
        : undefined,
      messageCount: messages.length,
      messages,
      workingPath: managed.workingPath,
      isStreaming: managed.session.isStreaming,
      planModeState: planModeState.enabled || planModeState.executing ? planModeState : undefined,
      pendingQuestion: pendingQuestion ? {
        questionId: pendingQuestion.questionId,
        questions: pendingQuestion.questions,
      } : undefined,
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

  async renameSession(
    id: string,
    name: string,
    broadcastEvent = true,
  ): Promise<{
    success: boolean;
    oldName?: string;
    error?: "not_found";
  }> {
    const managed = this.managedSessions.get(id);
    if (!managed) return { success: false, error: "not_found" };

    const oldName = managed.name;
    // Early return if name hasn't changed
    if (oldName === name) return { success: true, oldName };

    managed.name = name;
    managed.updatedAt = new Date().toISOString();
    managed.autoRenamed = true;

    // Update DB
    await prisma.session.update({ where: { id }, data: { name } }).catch(() => {});

    // Broadcast rename event to update UI in real-time
    if (broadcastEvent) {
      this.broadcast(managed, {
        type: "session_renamed",
        newName: name,
        oldName,
      });
    }

    return { success: true, oldName };
  }

  private static TITLE_PROMPT = `You are a title generator. You output ONLY a thread title. Nothing else.

<task>
Generate a brief title that would help the user find this conversation later.

Follow all rules in <rules>
Use the <examples> so you know what a good title looks like.
Your output must be:
- A single line
- ≤50 characters
- No explanations
</task>

<rules>
- you MUST use the same language as the user message you are summarizing
- Title must be grammatically correct and read naturally - no word salad
- Never include tool names in the title (e.g. "read tool", "bash tool", "edit tool")
- Focus on the main topic or question the user needs to retrieve
- Vary your phrasing - avoid repetitive patterns like always starting with "Analyzing"
- When a file is mentioned, focus on WHAT the user wants to do WITH the file, not just that they shared it
- Keep exact: technical terms, numbers, filenames, HTTP codes
- Remove: the, this, my, a, an
- Never assume tech stack
- Never use tools
- NEVER respond to questions, just generate a title for the conversation
- The title should NEVER include "summarizing" or "generating" when generating a title
- DO NOT SAY YOU CANNOT GENERATE A TITLE OR COMPLAIN ABOUT THE INPUT
- Always output something meaningful, even if the input is minimal.
- If the user message is short or conversational (e.g. "hello", "lol", "what's up", "hey"):
  → create a title that reflects the user's tone or intent (such as Greeting, Quick check-in, Light chat, Intro message, etc.)
</rules>

<examples>
"debug 500 errors in production" → Debugging production 500 errors
"refactor user service" → Refactoring user service
"why is app.js failing" → app.js failure investigation
"implement rate limiting" → Rate limiting implementation
"how do I connect postgres to my API" → Postgres API connection
"best practices for React hooks" → React hooks best practices
"@src/auth.ts can you add refresh token support" → Auth refresh token support
"@utils/parser.ts this is broken" → Parser bug fix
"look at @config.json" → Config review
"@App.tsx add dark mode toggle" → Dark mode toggle in App
</examples>`;

  private async generateSessionName(managed: ManagedSession): Promise<string> {
    const model = managed.session.model;
    if (!model) return this.fallbackSessionName(managed);

    // Collect user messages as context for title generation
    const userMessages = managed.session.messages
      .filter((m) => m.role === "user")
      .map((m) => {
        const text =
          typeof m.content === "string"
            ? m.content
            : m.content
                .filter((c: any) => c.type === "text")
                .map((c: any) => c.text)
                .join("");
        return text;
      })
      .filter(Boolean);

    if (userMessages.length === 0) return this.fallbackSessionName(managed);

    try {
      const apiKey = await this.modelRegistry.getApiKey(model);
      const result = await completeSimple(
        model,
        {
          systemPrompt: AgentManager.TITLE_PROMPT,
          messages: [
            {
              role: "user",
              content: userMessages.join("\n\n"),
              timestamp: Date.now(),
            },
          ],
        },
        { maxTokens: 60, apiKey: apiKey || undefined },
      );

      const title = result.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("")
        .trim()
        .replace(/^["']|["']$/g, ""); // strip surrounding quotes

      return title || this.fallbackSessionName(managed);
    } catch (err) {
      console.warn("AI title generation failed, using fallback:", err);
      return this.fallbackSessionName(managed);
    }
  }

  private fallbackSessionName(managed: ManagedSession): string {
    const lastUserMsg = managed.session.messages.filter((m) => m.role === "user").pop();
    if (!lastUserMsg) return managed.name;

    const text =
      typeof lastUserMsg.content === "string"
        ? lastUserMsg.content
        : lastUserMsg.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("");

    const trimmed = text.trim();
    if (trimmed.length <= 50) return trimmed;

    const first50 = trimmed.substring(0, 50);
    const lastSpace = first50.lastIndexOf(" ");
    return (lastSpace > 20 ? first50.substring(0, lastSpace) : first50) + "...";
  }

  async prompt(id: string, message: string): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);

    managed.updatedAt = new Date().toISOString();
    prisma.session.update({ where: { id }, data: { updatedAt: new Date() } }).catch(() => {});

    // Check for pending system events and inject them
    const agentId = managed.agentId;
    const systemEvents = this.systemEventQueue.drain(agentId);
    let enhancedMessage = message;
    
    if (systemEvents.length > 0) {
      const eventsContext = SystemEventQueue.formatAsContext(systemEvents);
      enhancedMessage = `${eventsContext}\n\n用户消息：${message}`;
      console.log(`[AgentManager] Injected ${systemEvents.length} system events for agent ${agentId}`);
    }

    // Check current plan mode state
    const currentState = this.getPlanModeState(id);

    // If plan is ready (enabled, not executing, has todos), treat new message as modification
    if (currentState.enabled && !currentState.executing && currentState.todos.length > 0) {
      // Set modifying state with the user's message
      this.setPlanModeState(id, {
        ...currentState,
        modifying: true,
        modifyMessage: message,
      });
      // Use prompt to start a new agent turn (followUp only works during streaming)
      managed.session.prompt(enhancedMessage).catch((err) => {
        this.broadcast(managed, { type: "error", message: String(err) });
      });
      return;
    }

    // Run prompt (non-blocking - returns after agent finishes)
    // SDK session automatically tracks user + assistant messages
    // Note: Agent can use enter_plan_mode tool if task is complex
    managed.session.prompt(enhancedMessage).catch((err) => {
      this.broadcast(managed, { type: "error", message: String(err) });
    });
  }

  /**
   * Handle plan mode action from user.
   * Called when user clicks execute/cancel or sends modification.
   */
  async planAction(
    id: string,
    action: "execute" | "cancel" | "modify",
    options?: { todos?: TodoItem[]; message?: string },
  ): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);

    const currentState = this.getPlanModeState(id);

    if (action === "execute") {
      // Switch to execution mode
      const todos = options?.todos ?? currentState.todos;
      const newState: PlanModeState = {
        enabled: false,
        executing: true,
        modifying: false,
        todos,
      };
      this.setPlanModeState(id, newState);
      managed.session.setActiveToolsByName(NORMAL_MODE_TOOLS);

      // Send message to trigger execution
      // If agent is streaming (plan mode just ended), use followUp
      // Otherwise use prompt to start the agent
      const firstStep = todos.find(t => !t.completed);
      const execMessage = firstStep
        ? `Execute the plan. Start with: ${firstStep.text}`
        : "Execute the plan.";

      if (managed.session.isStreaming) {
        await managed.session.followUp(execMessage);
      } else {
        await managed.session.prompt(execMessage);
      }

    } else if (action === "cancel") {
      // Exit plan mode
      this.setPlanModeState(id, { enabled: false, executing: false, modifying: false, todos: [] });
      managed.session.setActiveToolsByName(NORMAL_MODE_TOOLS);

    } else if (action === "modify") {
      // User wants to modify the plan
      if (options?.message) {
        // Set modifying state
        this.setPlanModeState(id, {
          ...currentState,
          modifying: true,
          modifyMessage: options.message,
        });
        // Send the modification as a followUp - agent will refine the plan
        await managed.session.followUp(options.message);
      }
    }
  }

  /**
   * Get current plan mode state for a session.
   */
  getPlanModeInfo(id: string): PlanModeState | null {
    const managed = this.managedSessions.get(id);
    if (!managed) return null;
    return this.getPlanModeState(id);
  }

  // ─── Question Tool Methods ────────────────────────────────────────────

  /**
   * Ask questions and wait for user responses.
   * This is called by the questionnaire tool.
   */
  async askQuestions(
    sessionId: string,
    questionId: string,
    questions: any[],
  ): Promise<{ questionId: string; answers: any[]; cancelled: boolean }> {
    // sessionId might be SDK sessionId, resolve to DB sessionId
    const dbSessionId = this.resolveDbSessionId(sessionId) ?? sessionId;
    
    const managed = this.managedSessions.get(dbSessionId);
    if (!managed) {
      throw new Error(`Session ${dbSessionId} not found`);
    }

    // Create promise that will be resolved when user answers
    return new Promise((resolve) => {
      // Store pending questionnaire using DB sessionId
      this.pendingQuestions.set(dbSessionId, {
        resolve,
        questionId,
        questions,
      });

      // Persist to database (fire-and-forget)
      this.savePendingQuestion(dbSessionId, { questionId, questions }).catch(err => {
        console.error(`[AgentManager] Failed to persist pendingQuestion:`, err);
      });

      // Broadcast question request to frontend
      this.broadcast(managed, {
        type: "question_request",
        questionId,
        questions,
      });
    });
  }

  /**
   * Resolve a pending questionnaire with user's answers.
   * This is called by the /sessions/:id/answer-question API endpoint.
   */
  resolveQuestionnaire(
    sessionId: string,
    answers: any[],
    cancelled: boolean,
  ): boolean {
    const pending = this.pendingQuestions.get(sessionId);
    if (!pending) {
      return false;
    }

    // Remove pending questionnaire from memory
    this.pendingQuestions.delete(sessionId);

    // Clear from database (fire-and-forget)
    this.clearPendingQuestion(sessionId).catch(err => {
      console.error(`[AgentManager] Failed to clear pendingQuestion:`, err);
    });

    // Resolve the promise
    pending.resolve({ 
      questionId: pending.questionId, 
      answers, 
      cancelled 
    });

    return true;
  }

  /**
   * Get pending questionnaire for a session (if any).
   */
  getPendingQuestion(sessionId: string): { questionId: string; questions: any[] } | null {
    const pending = this.pendingQuestions.get(sessionId);
    if (!pending) return null;
    return {
      questionId: pending.questionId,
      questions: pending.questions,
    };
  }

  async steer(id: string, message: string): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);
    await managed.session.steer(message);
  }

  async followUp(id: string, message: string): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);
    await managed.session.followUp(message);
  }

  getPendingMessages(id: string): { steering: string[]; followUp: string[] } | null {
    const managed = this.managedSessions.get(id);
    if (!managed) return null;
    return {
      steering: [...managed.session.getSteeringMessages()],
      followUp: [...managed.session.getFollowUpMessages()],
    };
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

  /**
   * Get available slash commands for a session.
   */
  getCommands(id: string): SlashCommandInfo[] {
    const managed = this.managedSessions.get(id);
    if (!managed) return [];

    const extensionRunner = managed.session.extensionRunner;
    if (!extensionRunner) return [];

    const commands = extensionRunner.getRegisteredCommands();
    return commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      source: "extension" as const,
    }));
  }

  /**
   * Execute a slash command in a session.
   * Constructs the command string and sends it via prompt().
   */
  async executeCommand(id: string, name: string, args?: string): Promise<void> {
    const managed = this.managedSessions.get(id);
    if (!managed) throw new Error(`Session ${id} not found`);

    // Construct command string like "/plan" or "/search keyword"
    const commandText = args ? `/${name} ${args}` : `/${name}`;

    // Use prompt to execute the command
    // SDK's prompt() automatically handles extension commands via _tryExecuteExtensionCommand
    await managed.session.prompt(commandText);
  }

  getContextUsage(id: string): { tokens: number | null; contextWindow: number; percent: number | null } | null {
    const managed = this.managedSessions.get(id);
    if (!managed) return null;
    const usage = managed.session.getContextUsage();
    if (!usage) return null;
    return {
      tokens: usage.tokens,
      contextWindow: usage.contextWindow,
      percent: usage.percent,
    };
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
      embedding: this.config.embedding,
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

  // ─── Embedding configuration ────────────────────────────────

  getEmbeddingConfig(): { provider: string; model?: string } | null {
    return this.config.embedding ?? null;
  }

  setEmbeddingConfig(provider: string, model?: string): void {
    this.config.embedding = { provider: provider as any, model };
    // Persist to DB (store as JSON in a separate table or appConfig)
    prisma.appConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", thinkingLevel: this.config.thinkingLevel },
      update: { 
        // Note: We need to add embedding column to DB schema
        // For now, store in memory only
      },
    }).catch((err) => console.error("Failed to persist embedding config:", err));
  }

  // ─── Theme management (delegated to ThemeManager) ──────────────────────

  async setActiveTheme(themeId: string): Promise<void> {
    await this.themeManager.setActiveTheme(themeId);
    // Update config for backward compatibility
    this.config.activeThemeId = this.themeManager.getActiveThemeId();
  }

  async getCustomThemes(): Promise<ThemeConfig[]> {
    const allThemes = await this.themeManager.getThemes();
    return allThemes.filter(t => !t.isBuiltIn);
  }

  async getAllThemes(): Promise<ThemeConfig[]> {
    return this.themeManager.getThemes();
  }

  async addCustomTheme(theme: ThemeConfig): Promise<void> {
    await this.themeManager.addCustomTheme(theme);
  }

  async updateCustomTheme(
    themeId: string,
    updates: Partial<ThemeConfig>,
  ): Promise<ThemeConfig | null> {
    return this.themeManager.updateCustomTheme(themeId, updates);
  }

  async deleteCustomTheme(themeId: string): Promise<boolean> {
    const result = await this.themeManager.deleteCustomTheme(themeId);
    // Update config for backward compatibility
    this.config.activeThemeId = this.themeManager.getActiveThemeId();
    return result;
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

  private broadcastGlobal(event: ConfigUpdatedEvent | SessionCreatedEvent): void {
    const globalEvent: GlobalSSEEvent = { ...event, sessionId: "__system__" } as GlobalSSEEvent;
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
          this.autoRenameSession(managed);
        }
      }

      // Check for memory flush trigger
      this.checkMemoryFlush(managed);
    }

    // Reset memory flush pending state when compaction completes
    if (event.type === "auto_compaction_end") {
      managed.memoryFlushPending = false;
    }

    // Forward SDK events directly to SSE subscribers
    this.broadcast(managed, event);
  }

  /**
   * Check if memory flush should be triggered before compaction
   */
  private checkMemoryFlush(managed: ManagedSession): void {
    // Skip if already pending or session is streaming
    if (managed.memoryFlushPending || managed.session.isStreaming) {
      return;
    }

    const stats = managed.session.getSessionStats();
    const model = managed.session.model;

    // Need model to get context window
    if (!model) {
      return;
    }

    const contextWindow = model.contextWindow;
    const totalTokens = stats.tokens.total;

    // Check if we should trigger memory flush
    const shouldFlush = shouldRunMemoryFlush({
      totalTokens,
      contextWindow,
      reserveTokensFloor: 20000,  // Default reserve
      softThreshold: 4000,        // Trigger 4k tokens before compaction
    });

    console.log(
      `[MemoryFlush] checkMemoryFlush: session=${managed.id}, tokens=${totalTokens}, contextWindow=${contextWindow}, shouldFlush=${shouldFlush}`,
    );

    if (shouldFlush) {
      this.triggerMemoryFlush(managed);
    }
  }

  /**
   * Trigger memory flush - inject a message to save memories
   */
  private async triggerMemoryFlush(managed: ManagedSession): Promise<void> {
    managed.memoryFlushPending = true;

    try {
      // Inject the memory flush prompt as a follow-up message
      // This will be processed after the current turn completes
      await managed.session.sendUserMessage(DEFAULT_MEMORY_FLUSH_PROMPT, {
        deliverAs: "followUp",
      });

      console.log(`[MemoryFlush] Triggered for session ${managed.id}`);
    } catch (error) {
      console.error(`[MemoryFlush] Failed to trigger:`, error);
      managed.memoryFlushPending = false;
    }
  }

  private async autoRenameSession(managed: ManagedSession): Promise<void> {
    const oldName = managed.name;
    const newName = await this.generateSessionName(managed);
    if (newName === oldName) return;

    await this.renameSession(managed.id, newName);
  }

  // ─── ICronManager Implementation (delegated to CronManager) ────────────

  async addCronJob(
    agentId: string,
    name: string,
    schedule: CronSchedule,
    message: string,
  ): Promise<{ id: string; nextRunAt?: Date }> {
    return this.cronManager.addCronJob(agentId, name, schedule, message);
  }

  async listCronJobs(agentId?: string): Promise<CronJobInfo[]> {
    return this.cronManager.listCronJobs(agentId);
  }

  async removeCronJob(jobId: string): Promise<boolean> {
    return this.cronManager.removeCronJob(jobId);
  }

  async updateCronJob(jobId: string, enabled: boolean): Promise<boolean> {
    return this.cronManager.updateCronJob(jobId, enabled);
  }

  async updateCronJobFull(
    jobId: string,
    updates: {
      name?: string;
      message?: string;
      schedule?: import("./cron/types.js").CronSchedule;
      enabled?: boolean;
    },
  ): Promise<boolean> {
    return this.cronManager.updateCronJobFull(jobId, updates);
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
