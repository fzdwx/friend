/**
 * Cron Service Types
 * 
 * Type definitions for the cron scheduling system.
 */

// ─── Schedule Types ─────────────────────────────────────────

/**
 * One-time schedule - runs once at a specific timestamp
 */
export interface AtSchedule {
  kind: "at";
  atMs: number;  // Absolute timestamp in milliseconds
}

/**
 * Recurring schedule - runs at regular intervals
 */
export interface EverySchedule {
  kind: "every";
  everyMs: number;    // Interval in milliseconds
  anchorMs?: number;  // Anchor time for alignment (optional)
}

/**
 * Cron expression schedule - runs based on cron expression
 */
export interface CronExpressionSchedule {
  kind: "cron";
  expr: string;   // Cron expression (e.g., "0 9 * * *" for daily at 9am)
  tz?: string;    // Timezone (optional, defaults to system timezone)
}

export type CronSchedule = AtSchedule | EverySchedule | CronExpressionSchedule;

// ─── Session Target Types ───────────────────────────────────

/**
 * Session target determines how cron jobs are executed.
 * 
 * - "main": Uses system event queue, injected into next prompt context
 *   (Does NOT add user message to chat history)
 * 
 * - "isolated": Creates temporary session for execution (future feature)
 */
export type CronSessionTarget = "main" | "isolated";

// ─── Payload Types ──────────────────────────────────────────

/**
 * System event payload - adds event to queue for next prompt context.
 * Best for simple reminders and notifications.
 */
export interface SystemEventPayload {
  kind: "systemEvent";
  text: string;              // Event text to inject into context
}

/**
 * Agent turn payload - triggers agent execution.
 */
export interface AgentTurnPayload {
  kind: "agentTurn";
  message: string;           // Message to send to the agent
  sessionTarget?: CronSessionTarget;  // Default: "main"
  deliver?: boolean;         // Whether to deliver result to user
}

export type CronPayload = SystemEventPayload | AgentTurnPayload;

// ─── Job State Types ────────────────────────────────────────

export type CronJobStatus = "ok" | "error" | "skipped";

export interface CronJobState {
  nextRunAtMs?: number;       // Next scheduled run time
  runningAtMs?: number;       // Currently running since (if running)
  lastRunAtMs?: number;       // Last run time
  lastStatus?: CronJobStatus; // Last run status
  lastError?: string;         // Last error message
  lastDurationMs?: number;    // Last run duration
  consecutiveErrors?: number; // Consecutive error count (for backoff)
}

// ─── Cron Job Types ──────────────────────────────────────────

export interface CronJob {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  state: CronJobState;
  createdAt: Date;
  updatedAt: Date;
}

export interface CronJobCreate {
  agentId: string;
  name: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
}

export interface CronJobUpdate {
  name?: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  schedule?: CronSchedule;
  payload?: CronPayload;
}

// ─── Service Types ───────────────────────────────────────────

export interface CronServiceDeps {
  getAgentSession: (agentId: string) => Promise<{ id: string; prompt: (msg: string) => Promise<void> } | null>;
  createAgentSession: (agentId: string) => Promise<{ id: string; prompt: (msg: string) => Promise<void> }>;
  enqueueSystemEvent: (agentId: string, text: string) => void;
  broadcastEvent?: (event: { type: string; jobId: string; agentId: string; status: string; message?: string }) => void;
}

export interface CronJobInfo {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastStatus?: CronJobStatus;
}

// ─── Error Backoff Schedule ─────────────────────────────────

/**
 * Exponential backoff delays (in ms) indexed by consecutive error count.
 * After the last entry the delay stays constant.
 */
export const ERROR_BACKOFF_SCHEDULE_MS = [
  30_000,        // 1st error  →  30s
  60_000,        // 2nd error  →   1 min
  5 * 60_000,    // 3rd error  →   5 min
  15 * 60_000,   // 4th error  →  15 min
  60 * 60_000,   // 5th+ error →  60 min
];

export function getErrorBackoffMs(consecutiveErrors: number): number {
  const idx = Math.min(consecutiveErrors - 1, ERROR_BACKOFF_SCHEDULE_MS.length - 1);
  return ERROR_BACKOFF_SCHEDULE_MS[Math.max(0, idx)];
}

// ─── Constants ──────────────────────────────────────────────

export const MAX_TIMER_DELAY_MS = 60_000;  // Maximum timer delay (1 minute)
export const MAX_SCHEDULE_ERRORS = 3;       // Auto-disable after this many schedule errors
export const JOB_TIMEOUT_MS = 10 * 60_000; // Job execution timeout (10 minutes)
