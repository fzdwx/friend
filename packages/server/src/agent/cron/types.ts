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

// ─── Payload Types ──────────────────────────────────────────

export interface AgentTurnPayload {
  kind: "agentTurn";
  message: string;          // Message to send to the agent
  deliver?: boolean;        // Whether to deliver result to user
}

export type CronPayload = AgentTurnPayload;

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
  broadcastEvent?: (event: { type: string; jobId: string; agentId: string; status: string; message?: string }) => void;
}

export interface CronJobInfo {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: CronSchedule;
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
