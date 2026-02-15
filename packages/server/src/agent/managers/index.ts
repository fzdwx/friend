/**
 * Manager Modules
 * 
 * This directory contains modular managers that handle specific concerns
 * of the AgentManager. Each manager is responsible for a single domain.
 * 
 * Architecture:
 * - AgentManager is the main orchestrator
 * - Each sub-manager handles a specific domain
 * - Managers receive dependencies via constructor injection
 * - AgentManager delegates to managers while maintaining the same public API
 */

// Types
export type {
  ManagedSession,
  IProviderManager,
  ProviderManagerDeps,
  IThemeManager,
  ThemeManagerDeps,
  ICronManager,
  IPlanModeManager,
  PlanModeManagerDeps,
  IQuestionManager,
  QuestionManagerDeps,
  ISessionManager,
  SessionManagerDeps,
  EventSubscriber,
} from "./types.js";

// Managers
export { ProviderManager } from "./provider-manager.js";
export { ThemeManager } from "./theme-manager.js";
export { CronManager } from "./cron-manager.js";
export { PlanModeManager } from "./plan-mode-manager.js";
export { QuestionManager } from "./question-manager.js";
