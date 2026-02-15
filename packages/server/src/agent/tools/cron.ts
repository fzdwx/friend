/**
 * Cron Tool
 * 
 * Allows agents to schedule reminders and tasks.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { CronService, CronSchedule, CronJobInfo } from "../cron/index.js";

// ─── Tool Parameters Schema ───────────────────────────────────

export const CronParams = Type.Object({
  action: Type.Union(
    [
      Type.Literal("add", { description: "Add a new scheduled task" }),
      Type.Literal("list", { description: "List all scheduled tasks" }),
      Type.Literal("remove", { description: "Remove a scheduled task" }),
      Type.Literal("enable", { description: "Enable a disabled task" }),
      Type.Literal("disable", { description: "Disable a task" }),
    ],
    { description: "Action to perform" },
  ),
  message: Type.Optional(
    Type.String({
      description: "The message/task to execute when triggered. Required for 'add' action.",
    }),
  ),
  at_seconds: Type.Optional(
    Type.Number({
      description: "One-time: seconds from now when to trigger (e.g., 600 for 10 minutes). Use for reminders like 'remind me in 10 minutes'.",
    }),
  ),
  every_seconds: Type.Optional(
    Type.Number({
      description: "Recurring: interval in seconds (e.g., 3600 for hourly). Use for periodic tasks like 'check every hour'.",
    }),
  ),
  cron_expr: Type.Optional(
    Type.String({
      description: "Cron expression for complex schedules (e.g., '0 9 * * *' for daily at 9am, '0 */2 * * *' for every 2 hours).",
    }),
  ),
  job_id: Type.Optional(
    Type.String({
      description: "Job ID for remove/enable/disable actions.",
    }),
  ),
  job_name: Type.Optional(
    Type.String({
      description: "Optional name for the scheduled task. Defaults to a truncated version of the message.",
    }),
  ),
});

// ─── Manager Interface ───────────────────────────────────────

import type { ICronManager } from "./custom-provider-add.js";

// ─── Tool Definition ───────────────────────────────────────

export function createCronTool(manager: ICronManager, agentId: string): ToolDefinition {
  return {
    name: "cron",
    label: "Schedule Tasks",
    description:
      "Schedule reminders, tasks, or recurring checks. " +
      "IMPORTANT: When user asks to be reminded or scheduled, you MUST call this tool. " +
      "Use 'at_seconds' for one-time reminders (e.g., 'remind me in 10 minutes'). " +
      "Use 'every_seconds' ONLY for recurring tasks (e.g., 'every 2 hours'). " +
      "Use 'cron_expr' for complex schedules like 'daily at 9am'.",
    parameters: CronParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { action, message, at_seconds, every_seconds, cron_expr, job_id, job_name } = params as {
        action: "add" | "list" | "remove" | "enable" | "disable";
        message?: string;
        at_seconds?: number;
        every_seconds?: number;
        cron_expr?: string;
        job_id?: string;
        job_name?: string;
      };

      try {
        switch (action) {
          case "add":
            return await handleAdd(manager, agentId, { message, at_seconds, every_seconds, cron_expr, job_name });
          case "list":
            return await handleList(manager, agentId);
          case "remove":
            return await handleRemove(manager, job_id);
          case "enable":
          case "disable":
            return await handleToggle(manager, job_id, action === "enable");
          default:
            return {
              content: [{ type: "text" as const, text: `Unknown action: ${action}` }],
              details: undefined,
            };
        }
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message || String(err)}` }],
          details: undefined,
        };
      }
    },
  };
}

// ─── Action Handlers ─────────────────────────────────────────

async function handleAdd(
  manager: ICronManager,
  agentId: string,
  opts: {
    message?: string;
    at_seconds?: number;
    every_seconds?: number;
    cron_expr?: string;
    job_name?: string;
  },
) {
  const { message, at_seconds, every_seconds, cron_expr, job_name } = opts;

  // Validate message
  if (!message) {
    return {
      content: [{ type: "text" as const, text: "Error: 'message' is required for adding a scheduled task." }],
      details: undefined,
    };
  }

  // Determine schedule type
  let schedule: CronSchedule;
  const now = Date.now();

  if (at_seconds !== undefined && at_seconds > 0) {
    // One-time task
    schedule = {
      kind: "at",
      atMs: now + at_seconds * 1000,
    };
  } else if (every_seconds !== undefined && every_seconds > 0) {
    // Recurring task
    schedule = {
      kind: "every",
      everyMs: every_seconds * 1000,
      anchorMs: now,
    };
  } else if (cron_expr) {
    // Cron expression
    schedule = {
      kind: "cron",
      expr: cron_expr,
    };
  } else {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: Must specify one of 'at_seconds', 'every_seconds', or 'cron_expr'.",
        },
      ],
      details: undefined,
    };
  }

  // Generate name if not provided
  const name = job_name || message.slice(0, 50) || "Scheduled task";

  // Add the job
  const result = await manager.addCronJob(agentId, name, schedule, message);

  // Format response
  let scheduleDesc: string;
  if (schedule.kind === "at") {
    const date = new Date(schedule.atMs);
    scheduleDesc = `once at ${date.toLocaleString()}`;
  } else if (schedule.kind === "every") {
    const seconds = Math.floor(schedule.everyMs / 1000);
    if (seconds < 60) {
      scheduleDesc = `every ${seconds}s`;
    } else if (seconds < 3600) {
      scheduleDesc = `every ${Math.floor(seconds / 60)}m`;
    } else {
      scheduleDesc = `every ${Math.floor(seconds / 3600)}h`;
    }
  } else {
    scheduleDesc = `cron: ${schedule.expr}`;
  }

  const nextRun = result.nextRunAt ? ` (next run: ${result.nextRunAt.toLocaleString()})` : "";

  return {
    content: [
      {
        type: "text" as const,
        text: `✅ Scheduled task created!\n- ID: ${result.id}\n- Name: ${name}\n- Schedule: ${scheduleDesc}${nextRun}\n- Message: "${message}"`,
      },
    ],
    details: { jobId: result.id, name, schedule: scheduleDesc },
  };
}

async function handleList(manager: ICronManager, agentId: string) {
  const jobs = await manager.listCronJobs(agentId);

  if (jobs.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No scheduled tasks found." }],
      details: undefined,
    };
  }

  const lines = ["📅 Scheduled tasks:", ""];
  for (const job of jobs) {
    const status = job.enabled ? "✅" : "⏸️";
    const scheduleDesc = formatSchedule(job);
    const nextRun = job.nextRunAt ? ` → ${job.nextRunAt.toLocaleString()}` : "";
    const lastRun = job.lastRunAt ? ` (last: ${job.lastRunAt.toLocaleString()})` : "";

    lines.push(`${status} **${job.name}** (${job.id})`);
    lines.push(`   Schedule: ${scheduleDesc}${nextRun}${lastRun}`);
    lines.push("");
  }

  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
    details: { count: jobs.length },
  };
}

async function handleRemove(manager: ICronManager, jobId?: string) {
  if (!jobId) {
    return {
      content: [{ type: "text" as const, text: "Error: 'job_id' is required for remove action." }],
      details: undefined,
    };
  }

  const removed = await manager.removeCronJob(jobId);

  if (removed) {
    return {
      content: [{ type: "text" as const, text: `🗑️ Removed scheduled task: ${jobId}` }],
      details: undefined,
    };
  } else {
    return {
      content: [{ type: "text" as const, text: `Error: Task ${jobId} not found.` }],
      details: undefined,
    };
  }
}

async function handleToggle(manager: ICronManager, jobId?: string, enabled?: boolean) {
  if (!jobId) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: 'job_id' is required for ${enabled ? "enable" : "disable"} action.`,
        },
      ],
      details: undefined,
    };
  }

  const success = await manager.updateCronJob(jobId, enabled ?? true);

  if (success) {
    const action = enabled ? "▶️ Enabled" : "⏸️ Disabled";
    return {
      content: [{ type: "text" as const, text: `${action} task: ${jobId}` }],
      details: undefined,
    };
  } else {
    return {
      content: [{ type: "text" as const, text: `Error: Task ${jobId} not found.` }],
      details: undefined,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function formatSchedule(job: CronJobInfo): string {
  const { schedule } = job;

  if (schedule.kind === "at") {
    return `once`;
  } else if (schedule.kind === "every") {
    const seconds = Math.floor(schedule.everyMs / 1000);
    if (seconds < 60) {
      return `every ${seconds}s`;
    } else if (seconds < 3600) {
      return `every ${Math.floor(seconds / 60)}m`;
    } else if (seconds < 86400) {
      return `every ${Math.floor(seconds / 3600)}h`;
    } else {
      return `every ${Math.floor(seconds / 86400)}d`;
    }
  } else {
    return `cron: ${schedule.expr}`;
  }
}
