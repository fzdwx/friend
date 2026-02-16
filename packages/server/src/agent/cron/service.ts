/**
 * Cron Service
 * 
 * Manages scheduled tasks with support for one-time, recurring, and cron-based schedules.
 * Inspired by PicoClaw and OpenClaw implementations.
 */

import { prisma } from "@friend/db";
import type { DbCronJob } from "@friend/shared";
import type { CronJob, CronJobCreate, CronJobUpdate, CronJobInfo, CronServiceDeps, CronSchedule, CronPayload, CronJobState } from "./types.js";
import { computeNextRunAtMs, describeSchedule } from "./schedule.js";
import { MAX_TIMER_DELAY_MS, MAX_SCHEDULE_ERRORS, JOB_TIMEOUT_MS, getErrorBackoffMs } from "./types.js";
import { cronLogger as logger } from "../utils/logger.js";
import { getErrorMessage, isCancelledError } from "../utils/errors.js";

// Re-export Prisma types for use in this file
type CronJobWhereInput = {
  agentId?: string;
  enabled?: boolean;
};

type CronJobUpdateInput = {
  name?: string;
  description?: string | null;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  schedule?: string;
  payload?: string;
  state?: string;
};

// ─── CronService ─────────────────────────────────────────────

export class CronService {
  private deps: CronServiceDeps;
  private timer: NodeJS.Timeout | null = null;
  private running: boolean = false;

  constructor(deps: CronServiceDeps) {
    this.deps = deps;
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  async start(): Promise<void> {
    logger.debug("Service starting...");
    
    // Initialize next run times for jobs without them
    await this.initializeNextRunTimes();
    
    // Arm the timer
    await this.armTimer();
    
    logger.debug("Service started");
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.debug("Service stopped");
  }

  // ─── Timer Management ──────────────────────────────────────

  private async armTimer(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Refresh cached next wake time
    await this.refreshNextWakeAtMs();
    
    const nextWakeAtMs = this.getNextWakeAtMs();
    
    if (!nextWakeAtMs) {
      logger.debug("No jobs scheduled, timer not armed");
      return;
    }

    const now = Date.now();
    const delay = Math.min(Math.max(nextWakeAtMs - now, 0), MAX_TIMER_DELAY_MS);

    logger.debug(`Timer armed, next check in ${delay}ms`);

    this.timer = setTimeout(() => this.onTimer(), delay);
  }

  private async onTimer(): Promise<void> {
    if (this.running) {
      // Re-arm the timer to check again soon
      this.timer = setTimeout(() => this.onTimer(), 1000);
      return;
    }

    this.running = true;
    
    try {
      const dueJobs = await this.findDueJobs();
      
      for (const job of dueJobs) {
        await this.executeJob(job);
      }
    } catch (err: unknown) {
      logger.error("Timer error", err);
    } finally {
      this.running = false;
      await this.armTimer();
    }
  }

  // ─── Job Execution ─────────────────────────────────────────

  private async findDueJobs(): Promise<CronJob[]> {
    const now = Date.now();
    const jobs = await prisma.cronJob.findMany({
      where: { enabled: true },
    });

    return jobs.filter((job) => {
      const state = this.parseState(job.state);
      // Not currently running and next run time has passed
      return !state.runningAtMs && state.nextRunAtMs && state.nextRunAtMs <= now;
    }).map((j) => this.dbJobToJob(j));
  }

  private async executeJob(job: CronJob): Promise<void> {
    logger.debug(`Executing job ${job.id} (${job.name})`);

    const startedAt = Date.now();

    // Mark as running
    await this.updateJobState(job.id, {
      runningAtMs: startedAt,
    });

    let status: "ok" | "error" | "skipped" = "ok";
    let errorMessage: string | undefined;
    let resultMessage: string | undefined;

    try {
      if (job.payload.kind === "systemEvent") {
        // System event - enqueue silently, no session needed
        const timestamp = new Date(startedAt).toLocaleString();
        const text = `[cron:${job.id} ${job.name}] ${job.payload.text}\n${timestamp}`;
        this.deps.enqueueSystemEvent(job.agentId, text);
        resultMessage = `System event "${job.name}" enqueued`;
        status = "ok";
        logger.debug(`Job ${job.id} enqueued system event for agent ${job.agentId}`);

      } else if (job.payload.kind === "agentTurn") {
        // Agent turn - needs a session to prompt
        const session = await this.deps.getAgentSession(job.agentId);
        if (session) {
          const timestamp = new Date(startedAt).toLocaleString();
          const message = `[cron:${job.id} ${job.name}] ${job.payload.message}\n${timestamp}`;

          // Wrap in timeout
          await Promise.race([
            session.prompt(message),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Job timed out after ${JOB_TIMEOUT_MS}ms`)), JOB_TIMEOUT_MS),
            ),
          ]);

          resultMessage = `Job "${job.name}" executed`;
          status = "ok";
          logger.info(`Job ${job.id} executed for agent ${job.agentId}`);
        } else {
          logger.warn(`Job ${job.id}: no session available, skipping`);
          status = "skipped";
          errorMessage = "No session available";
        }
      }
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err);
      logger.error(`Job ${job.id} error: ${errorMsg}`, err);
      status = "error";
      errorMessage = errorMsg;
    }

    const endedAt = Date.now();
    
    // Update state
    const currentState = await this.getJobState(job.id);
    const newState: Partial<CronJobState> = {
      runningAtMs: undefined,
      lastRunAtMs: startedAt,
      lastStatus: status,
      lastError: errorMessage,
      lastDurationMs: endedAt - startedAt,
    };

    // Handle error backoff
    if (status === "error") {
      const consecutiveErrors = (currentState.consecutiveErrors || 0) + 1;
      newState.consecutiveErrors = consecutiveErrors;
      
      // Apply backoff
      const backoffMs = getErrorBackoffMs(consecutiveErrors);
      const normalNext = computeNextRunAtMs(job.schedule, endedAt);
      newState.nextRunAtMs = normalNext ? Math.max(normalNext, endedAt + backoffMs) : endedAt + backoffMs;
      
      logger.warn(`Job ${job.id} error #${consecutiveErrors}, backoff ${backoffMs}ms`);
      
      // Auto-disable after too many consecutive errors
      if (consecutiveErrors >= MAX_SCHEDULE_ERRORS) {
        await prisma.cronJob.update({
          where: { id: job.id },
          data: { enabled: false },
        });
        newState.nextRunAtMs = undefined;
        logger.warn(`Job ${job.id} auto-disabled after ${consecutiveErrors} consecutive errors`);
        
        // Broadcast auto-disable event
        if (this.deps.broadcastEvent) {
          this.deps.broadcastEvent({
            type: "cron_job",
            jobId: job.id,
            agentId: job.agentId,
            status: "error",
            message: `Job auto-disabled after ${consecutiveErrors} consecutive errors: ${errorMessage}`,
          });
        }
      }
    } else {
      newState.consecutiveErrors = 0;
      
      // Handle one-shot jobs
      if (job.schedule.kind === "at") {
        // Disable one-shot job after successful run
        await prisma.cronJob.update({
          where: { id: job.id },
          data: { enabled: false },
        });
        newState.nextRunAtMs = undefined;
      } else if (job.deleteAfterRun) {
        // Delete if marked
        await prisma.cronJob.delete({ where: { id: job.id } });
        logger.debug(`Job ${job.id} deleted after run`);
      } else {
        // Compute next run time
        newState.nextRunAtMs = computeNextRunAtMs(job.schedule, endedAt);
      }
    }

    await this.updateJobState(job.id, newState);

    // Broadcast event
    if (this.deps.broadcastEvent) {
      this.deps.broadcastEvent({
        type: "cron_job",
        jobId: job.id,
        agentId: job.agentId,
        status,
        message: resultMessage || errorMessage,
      });
    }
  }

  // ─── CRUD Operations ───────────────────────────────────────

  async addJob(input: CronJobCreate): Promise<CronJob> {
    const now = Date.now();
    const scheduleJson = JSON.stringify(input.schedule);
    const payloadJson = JSON.stringify(input.payload);
    
    // Compute initial next run time
    const nextRunAtMs = input.enabled !== false 
      ? computeNextRunAtMs(input.schedule, now)
      : undefined;
    
    const state: CronJobState = {
      nextRunAtMs,
    };

    const dbJob = await prisma.cronJob.create({
      data: {
        agentId: input.agentId,
        name: input.name,
        description: input.description,
        enabled: input.enabled ?? true,
        deleteAfterRun: input.deleteAfterRun ?? false,
        schedule: scheduleJson,
        payload: payloadJson,
        state: JSON.stringify(state),
      },
    });

    logger.info(`Job created: ${dbJob.id} (${dbJob.name}), next run: ${nextRunAtMs ? new Date(nextRunAtMs).toLocaleString() : 'none'}`);

    // Re-arm timer in case this job is sooner
    await this.armTimer();

    return this.dbJobToJob(dbJob);
  }

  async updateJob(id: string, input: CronJobUpdate): Promise<CronJob | null> {
    const existing = await prisma.cronJob.findUnique({ where: { id } });
    if (!existing) return null;

    const now = Date.now();
    const updates: CronJobUpdateInput = {};

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.enabled !== undefined) updates.enabled = input.enabled;
    if (input.deleteAfterRun !== undefined) updates.deleteAfterRun = input.deleteAfterRun;
    if (input.schedule !== undefined) {
      updates.schedule = JSON.stringify(input.schedule);
    }
    if (input.payload !== undefined) {
      updates.payload = JSON.stringify(input.payload);
    }

    // Recompute next run if schedule or enabled changed
    if (input.schedule !== undefined || input.enabled !== undefined) {
      const state = this.parseState(existing.state);
      const schedule = input.schedule || this.parseSchedule(existing.schedule);
      
      state.nextRunAtMs = input.enabled !== false
        ? computeNextRunAtMs(schedule, now)
        : undefined;
      
      updates.state = JSON.stringify(state);
    }

    const dbJob = await prisma.cronJob.update({
      where: { id },
      data: updates,
    });

    // Re-arm timer
    await this.armTimer();

    return this.dbJobToJob(dbJob);
  }

  async removeJob(id: string): Promise<boolean> {
    try {
      await prisma.cronJob.delete({ where: { id } });
      logger.info(`Job removed: ${id}`);
      await this.armTimer();
      return true;
    } catch {
      return false;
    }
  }

  async listJobs(opts?: { agentId?: string; includeDisabled?: boolean }): Promise<CronJobInfo[]> {
    const where: CronJobWhereInput = {};
    
    if (opts?.agentId) {
      where.agentId = opts.agentId;
    }
    
    if (!opts?.includeDisabled) {
      where.enabled = true;
    }

    const jobs = await prisma.cronJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return jobs.map((job) => {
      const state = this.parseState(job.state);
      return {
        id: job.id,
        agentId: job.agentId,
        name: job.name,
        description: job.description ?? undefined,
        enabled: job.enabled,
        schedule: this.parseSchedule(job.schedule),
        payload: this.parsePayload(job.payload),
        nextRunAt: state.nextRunAtMs ? new Date(state.nextRunAtMs) : undefined,
        lastRunAt: state.lastRunAtMs ? new Date(state.lastRunAtMs) : undefined,
        lastStatus: state.lastStatus,
      };
    });
  }

  async getJob(id: string): Promise<CronJob | null> {
    const dbJob = await prisma.cronJob.findUnique({ where: { id } });
    return dbJob ? this.dbJobToJob(dbJob) : null;
  }

  // ─── Helper Methods ────────────────────────────────────────

  private cachedNextWakeAtMs: number | undefined;
  
  private getNextWakeAtMs(): number | undefined {
    // Return cached value (updated after each operation)
    return this.cachedNextWakeAtMs;
  }

  private async refreshNextWakeAtMs(): Promise<void> {
    const jobs = await prisma.cronJob.findMany({
      where: { enabled: true },
      select: { state: true },
    });

    let minNext: number | undefined;
    for (const job of jobs) {
      const state = this.parseState(job.state);
      if (state.nextRunAtMs && !state.runningAtMs) {
        if (!minNext || state.nextRunAtMs < minNext) {
          minNext = state.nextRunAtMs;
        }
      }
    }
    
    this.cachedNextWakeAtMs = minNext;
  }

  private async initializeNextRunTimes(): Promise<void> {
    const jobs = await prisma.cronJob.findMany({
      where: { enabled: true },
    });

    const now = Date.now();

    for (const job of jobs) {
      const state = this.parseState(job.state);
      
      // Skip if already has next run time
      if (state.nextRunAtMs) continue;
      
      const schedule = this.parseSchedule(job.schedule);
      const nextRunAtMs = computeNextRunAtMs(schedule, now);
      
      if (nextRunAtMs) {
        state.nextRunAtMs = nextRunAtMs;
        await prisma.cronJob.update({
          where: { id: job.id },
          data: { state: JSON.stringify(state) },
        });
      }
    }
  }

  private async getJobState(id: string): Promise<CronJobState> {
    const job = await prisma.cronJob.findUnique({
      where: { id },
      select: { state: true },
    });
    return job ? this.parseState(job.state) : {};
  }

  private async updateJobState(id: string, updates: Partial<CronJobState>): Promise<void> {
    const job = await prisma.cronJob.findUnique({
      where: { id },
      select: { state: true },
    });
    
    if (!job) return;
    
    const state = this.parseState(job.state);
    Object.assign(state, updates);
    
    await prisma.cronJob.update({
      where: { id },
      data: { state: JSON.stringify(state) },
    });
  }

  private parseState(stateJson: string): CronJobState {
    try {
      return JSON.parse(stateJson) as CronJobState;
    } catch {
      return {};
    }
  }

  private parseSchedule(scheduleJson: string): CronSchedule {
    return JSON.parse(scheduleJson) as CronSchedule;
  }

  private parsePayload(payloadJson: string): CronPayload {
    return JSON.parse(payloadJson) as CronPayload;
  }

  private dbJobToJob(dbJob: DbCronJob): CronJob {
    return {
      id: dbJob.id,
      agentId: dbJob.agentId,
      name: dbJob.name,
      description: dbJob.description ?? undefined,
      enabled: dbJob.enabled,
      deleteAfterRun: dbJob.deleteAfterRun,
      schedule: this.parseSchedule(dbJob.schedule),
      payload: this.parsePayload(dbJob.payload),
      state: this.parseState(dbJob.state),
      createdAt: dbJob.createdAt,
      updatedAt: dbJob.updatedAt,
    };
  }
}
