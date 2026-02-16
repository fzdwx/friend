/**
 * Shared types and interfaces for manager modules
 */

import type { AgentSession, DefaultResourceLoader } from "@mariozechner/pi-coding-agent";
import type { CronSchedule, CronJobInfo } from "../cron/types.js";
import type {
  CustomProviderConfig,
  ThemeConfig,
  PlanModeState,
  PendingQuestion,
  SessionInfo,
  SessionDetail,
  Question,
  QuestionAnswer,
  QuestionnaireResolveValue,
  SSEEvent,
  ConfigUpdatedEvent,
  SessionCreatedEvent,
} from "@friend/shared";
import type { TodoItem } from "../extensions/plan-mode.js";

// ─── Managed Session ──────────────────────────────────────

export interface ManagedSession {
  id: string;
  name: string;
  agentId: string;
  session: AgentSession;
  resourceLoader: DefaultResourceLoader;
  createdAt: string;
  updatedAt: string;
  workingPath?: string;
  userMessageCount: number;
  autoRenamed?: boolean;
  memoryFlushPending?: boolean;
  planModeState?: PlanModeState;
  needContextRefresh?: boolean; // Flag to force context reload on next turn
}

// ─── Provider Manager Interface ───────────────────────────

export interface IProviderManager {
  addCustomProvider(provider: CustomProviderConfig, persist?: boolean): void;
  listCustomProviders(): CustomProviderConfig[];
  updateCustomProvider(name: string, updates: Partial<CustomProviderConfig>): boolean;
  removeCustomProvider(name: string): Promise<boolean>;
  getProviderModels(): { provider: string; models: string[] }[];
}

export interface ProviderManagerDeps {
  getManagedSessions: () => Map<string, ManagedSession>;
  broadcastGlobal: (event: ConfigUpdatedEvent | SessionCreatedEvent) => void;
}

// ─── Theme Manager Interface ──────────────────────────────

export interface IThemeManager {
  getThemes(): Promise<ThemeConfig[]>;
  setActiveTheme(themeId: string): Promise<void>;
  addCustomTheme(theme: ThemeConfig): Promise<ThemeConfig>;
  updateCustomTheme(themeId: string, updates: Partial<ThemeConfig>): Promise<ThemeConfig | null>;
  deleteCustomTheme(themeId: string): Promise<boolean>;
}

export interface ThemeManagerDeps {
  getActiveThemeId: () => string;
  setActiveThemeId: (id: string) => void;
  broadcastGlobal: (event: ConfigUpdatedEvent | SessionCreatedEvent) => void;
}

// ─── Cron Manager Interface ────────────────────────────────

export interface ICronManager {
  addCronJob(
    agentId: string,
    name: string,
    schedule: CronSchedule,
    message: string,
  ): Promise<{ id: string; nextRunAt?: Date }>;
  listCronJobs(agentId?: string): Promise<CronJobInfo[]>;
  removeCronJob(jobId: string): Promise<boolean>;
  updateCronJob(jobId: string, enabled: boolean): Promise<boolean>;
  updateCronJobFull(
    jobId: string,
    updates: {
      name?: string;
      message?: string;
      schedule?: CronSchedule;
      enabled?: boolean;
      payload?: { kind: "agentTurn"; message: string } | { kind: "systemEvent"; text: string };
    },
  ): Promise<boolean>;
}

// ─── Plan Mode Manager Interface ──────────────────────────

export interface IPlanModeManager {
  getState(sessionId: string): PlanModeState;
  setState(sessionId: string, state: PlanModeState): void;
  handlePlanReady(sessionId: string, todos: TodoItem[]): void;
  handlePlanProgress(sessionId: string, todos: TodoItem[]): void;
  handlePlanComplete(sessionId: string, todos: TodoItem[]): void;
  executePlan(sessionId: string, todos?: TodoItem[]): Promise<void>;
  cancelPlan(sessionId: string): void;
  modifyPlan(sessionId: string, message: string): Promise<void>;
}

export interface PlanModeManagerDeps {
  getManagedSession: (sessionId: string) => ManagedSession | undefined;
  broadcast: (managed: ManagedSession, event: SSEEvent) => void;
  saveState: (sessionId: string, state: PlanModeState) => Promise<void>;
}

// ─── Question Manager Interface ───────────────────────────

export interface IQuestionManager {
  askQuestions(
    sessionId: string,
    questionId: string,
    questions: Question[],
  ): Promise<QuestionnaireResolveValue>;
  resolveQuestionnaire(sessionId: string, answers: QuestionAnswer[], cancelled: boolean): boolean;
  getPendingQuestion(sessionId: string): PendingQuestion | null;
}

export interface QuestionManagerDeps {
  getManagedSession: (sessionId: string) => ManagedSession | undefined;
  broadcast: (managed: ManagedSession, event: SSEEvent) => void;
  savePendingQuestion: (sessionId: string, question: PendingQuestion) => Promise<void>;
  clearPendingQuestion: (sessionId: string) => Promise<void>;
  resolveDbSessionId: (sdkSessionId: string) => string | undefined;
}

// ─── Session Manager Interface ────────────────────────────

import type { SessionManager as SDKSessionManager } from "@mariozechner/pi-coding-agent";
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";

export interface ISessionManager {
  listSessions(): Promise<SessionInfo[]>;
  createSession(opts?: { name?: string; workingPath?: string; agentId?: string }): Promise<SessionInfo>;
  getSession(id: string): Promise<SessionDetail | null>;
  renameSession(id: string, name: string): Promise<{ success: boolean; oldName?: string; error?: "not_found" }>;
  deleteSession(id: string): Promise<boolean>;
  getOrCreateSessionForAgent(agentId: string): Promise<ManagedSession>;
}

export interface SessionManagerDeps {
  getManagedSessions: () => Map<string, ManagedSession>;
  setManagedSession: (id: string, session: ManagedSession) => void;
  deleteManagedSession: (id: string) => boolean;
  createAgentSessionWithSkills: (
    cwd: string,
    sessionManager: SDKSessionManager,
    agentId: string,
    dbSessionId?: string
  ) => Promise<{ session: AgentSession; resourceLoader: DefaultResourceLoader }>;
  setupEventListeners: (managed: ManagedSession) => void;
  broadcastGlobal: (event: ConfigUpdatedEvent | SessionCreatedEvent) => void;
  modelRegistry: ModelRegistry;
}

// ─── Event Subscriber ──────────────────────────────────────

export interface EventSubscriber {
  push(event: SSEEvent & { sessionId: string }): void;
  close(): void;
}

// ─── Agent Manager Interface for Tools ───────────────────────
// This is a unified interface used by tool files to access manager functionality

import type { SlashCommandInfo } from "@mariozechner/pi-coding-agent";

export interface IAgentManager {
  // Provider methods
  addCustomProvider(provider: CustomProviderConfig, persist?: boolean): void;
  getCustomProviders(): CustomProviderConfig[];
  removeCustomProvider?(name: string): Promise<boolean>;

  // Theme methods
  setActiveTheme?(themeId: string): Promise<void>;
  addCustomTheme?(theme: ThemeConfig): Promise<void>;
  getCustomThemes?(): Promise<ThemeConfig[]>;
  getAllThemes?(): Promise<ThemeConfig[]>;

  // Session methods
  listSessions?(): Promise<SessionInfo[]>;
  createSession?(opts?: { name?: string; workingPath?: string; agentId?: string }): Promise<SessionInfo>;
  createSessionWithAgent?(
    agentId: string,
    opts?: { name?: string; workingPath?: string },
  ): Promise<{ id: string; name: string; agentId: string; workingPath?: string }>;
  getSession?(id: string): Promise<SessionDetail | null>;
  renameSession?(id: string, name: string): Promise<{ success: boolean; oldName?: string; error?: "not_found" }>;
  deleteSession?(id: string): Promise<boolean>;

  // Command methods
  getCommands?(id: string): SlashCommandInfo[];
  executeCommand?(id: string, name: string, args?: string): Promise<void>;
}
