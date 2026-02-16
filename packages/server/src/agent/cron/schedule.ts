/**
 * Cron Schedule Calculator
 * 
 * Computes next run times for different schedule types.
 */

import CronExpressionParser from "cron-parser";
import type { CronSchedule } from "./types.js";

// ─── Main Entry Point ───────────────────────────────────────

/**
 * Compute the next run time for a schedule.
 * Returns undefined if no valid next run time can be computed.
 */
export function computeNextRunAtMs(
  schedule: CronSchedule,
  nowMs: number
): number | undefined {
  switch (schedule.kind) {
    case "at":
      return computeAtNextRun(schedule, nowMs);
    case "every":
      return computeEveryNextRun(schedule, nowMs);
    case "cron":
      return computeCronNextRun(schedule, nowMs);
    default:
      console.warn(`[Cron] Unknown schedule kind: ${(schedule as any).kind}`);
      return undefined;
  }
}

// ─── At Schedule (One-time) ──────────────────────────────────

function computeAtNextRun(
  schedule: { kind: "at"; atMs: number },
  nowMs: number
): number | undefined {
  const { atMs } = schedule;
  
  // If the time has already passed, return undefined (no next run)
  if (atMs <= nowMs) {
    return undefined;
  }
  
  return atMs;
}

// ─── Every Schedule (Recurring) ──────────────────────────────

function computeEveryNextRun(
  schedule: { kind: "every"; everyMs: number; anchorMs?: number },
  nowMs: number
): number | undefined {
  const { everyMs, anchorMs } = schedule;
  
  if (everyMs <= 0) {
    return undefined;
  }
  
  // If no anchor, next run is simply now + interval
  if (anchorMs === undefined || anchorMs === null) {
    return nowMs + everyMs;
  }
  
  // With anchor, calculate next aligned run time
  // This ensures recurring jobs stay aligned to their original schedule
  const elapsed = nowMs - anchorMs;
  const periods = Math.floor(elapsed / everyMs);
  const nextAligned = anchorMs + (periods + 1) * everyMs;
  
  return Math.max(nextAligned, nowMs + 1);  // Ensure future time
}

// ─── Cron Expression Schedule ────────────────────────────────

/**
 * Compute next run time for cron expression using cron-parser library.
 */
function computeCronNextRun(
  schedule: { kind: "cron"; expr: string; tz?: string },
  nowMs: number
): number | undefined {
  try {
    // Use inline type import to avoid namespace issues
    const options: {
      currentDate: Date;
      tz?: string;
    } = {
      currentDate: new Date(nowMs),
    };
    
    // Add timezone if specified
    if (schedule.tz) {
      options.tz = schedule.tz;
    }
    
    const interval = CronExpressionParser.parse(schedule.expr, options);
    const nextDate = interval.next();
    
    return nextDate.getTime();
  } catch (err) {
    console.warn(`[Cron] Error parsing cron expression: ${schedule.expr}`, err);
    return undefined;
  }
}

// ─── Human-readable Schedule Description ─────────────────────

/**
 * Generate a human-readable description of a schedule.
 */
export function describeSchedule(schedule: CronSchedule): string {
  switch (schedule.kind) {
    case "at":
      return `once at ${new Date(schedule.atMs).toLocaleString()}`;
    case "every":
      const everySec = Math.floor(schedule.everyMs / 1000);
      if (everySec < 60) {
        return `every ${everySec}s`;
      } else if (everySec < 3600) {
        return `every ${Math.floor(everySec / 60)}m`;
      } else {
        return `every ${Math.floor(everySec / 3600)}h`;
      }
    case "cron":
      return `cron: ${schedule.expr}`;
    default:
      return "unknown schedule";
  }
}
