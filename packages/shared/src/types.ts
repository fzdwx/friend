/**
 * Common Types
 *
 * This file defines shared types used across the application.
 * Types are organized by domain:
 * - DB Schema Types: Match Prisma models for type-safe database operations
 * - Error Types: Structured error handling
 * - Utility Types: Common patterns and helpers
 */

// ─── DB Schema Types ────────────────────────────────────────
// These types match the Prisma schema for type-safe DB operations

/**
 * Session record from database
 */
export interface DbSession {
  id: string;
  name: string;
  agentId: string;
  model: string | null;
  workingPath: string | null;
  sessionFile: string | null;
  planModeState: string | null;  // JSON string
  pendingQuestion: string | null; // JSON string
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent record from database
 */
export interface DbAgent {
  id: string;
  name: string;
  isDefault: boolean;
  emoji: string | null;
  vibe: string | null;
  avatar: string | null;
  defaultModel: string | null;
  thinkingLevel: string | null;
  workspacePath: string | null;
  heartbeatEvery: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Custom provider record from database
 */
export interface DbCustomProvider {
  name: string;
  baseUrl: string;
  apiKey: string | null;
  api: string | null;
  headers: string | null; // JSON string of Record<string, string>
  models: DbCustomModel[];
}

/**
 * Custom model record from database
 */
export interface DbCustomModel {
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
}

/**
 * AppConfig record from database
 */
export interface DbAppConfig {
  id: string;
  thinkingLevel: string;
  activeThemeId: string;
}

/**
 * Custom theme record from database
 */
export interface DbCustomTheme {
  id: string;
  name: string;
  mode: string; // "light" | "dark"
  colors: string; // JSON string of ColorSet
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CronJob record from database
 */
export interface DbCronJob {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  deleteAfterRun: boolean;
  schedule: string; // JSON string
  payload: string;  // JSON string
  state: string;    // JSON string
  createdAt: Date;
  updatedAt: Date;
}

// ─── Error Types ─────────────────────────────────────────────

/**
 * Base error categories for structured error handling
 */
export type ErrorCategory =
  | "validation"   // Input validation errors
  | "not_found"    // Resource not found
  | "conflict"     // Resource conflict (e.g., duplicate)
  | "unauthorized" // Authentication/authorization errors
  | "external"     // External service errors (API, network)
  | "internal"     // Internal server errors
  | "timeout"      // Operation timeout
  | "cancelled";   // User cancelled operation

/**
 * Structured application error
 */
export interface AppError {
  category: ErrorCategory;
  code: string;          // Machine-readable error code
  message: string;       // Human-readable message
  details?: unknown;     // Additional context
  cause?: Error;         // Original error if wrapping
}

/**
 * Error codes for common scenarios
 */
export const ErrorCodes = {
  // Validation
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  
  // Not Found
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  SKILL_NOT_FOUND: "SKILL_NOT_FOUND",
  CRON_JOB_NOT_FOUND: "CRON_JOB_NOT_FOUND",
  PROVIDER_NOT_FOUND: "PROVIDER_NOT_FOUND",
  THEME_NOT_FOUND: "THEME_NOT_FOUND",
  
  // Conflict
  SESSION_EXISTS: "SESSION_EXISTS",
  PROVIDER_EXISTS: "PROVIDER_EXISTS",
  
  // External
  API_ERROR: "API_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  
  // Internal
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DB_ERROR: "DB_ERROR",
  
  // Timeout
  TIMEOUT: "TIMEOUT",
  JOB_TIMEOUT: "JOB_TIMEOUT",
  
  // Cancelled
  CANCELLED: "CANCELLED",
  USER_CANCELLED: "USER_CANCELLED",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ─── Utility Types ───────────────────────────────────────────

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Extract the promise type from a function return
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Non-null assertion for type narrowing
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Deep partial type for nested updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Result type for operations that can fail
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create a successful result
 */
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create a failed result
 */
export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ─── JSON Types ──────────────────────────────────────────────

/**
 * JSON primitive types
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON value (recursive)
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * JSON object
 */
export interface JsonObject {
  [key: string]: JsonValue;
}

/**
 * JSON array
 */
export type JsonArray = JsonValue[];

// ─── Brand Types ─────────────────────────────────────────────

/**
 * Create a branded type for nominal typing
 * Useful for IDs and other strings that shouldn't be mixed up
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Branded ID types for type safety
 */
export type SessionId = Brand<string, "SessionId">;
export type AgentId = Brand<string, "AgentId">;
export type CronJobId = Brand<string, "CronJobId">;
