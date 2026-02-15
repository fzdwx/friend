/**
 * Cron Manager
 * 
 * Wrapper around CronService that implements ICronManager.
 * This is a thin delegation layer.
 */

import type { CronService } from "../cron/service.js";
import type { CronSchedule, CronJobInfo } from "../cron/types.js";
import type { ICronManager } from "./types.js";

export class CronManager implements ICronManager {
  private readonly cronService: CronService | null;

  constructor(cronService: CronService | null) {
    this.cronService = cronService;
  }

  async addCronJob(
    agentId: string,
    name: string,
    schedule: CronSchedule,
    message: string,
  ): Promise<{ id: string; nextRunAt?: Date }> {
    if (!this.cronService) {
      throw new Error("CronService not initialized");
    }

    const job = await this.cronService.addJob({
      agentId,
      name,
      schedule,
      payload: { kind: "agentTurn", message },
    });

    return {
      id: job.id,
      nextRunAt: job.state.nextRunAtMs ? new Date(job.state.nextRunAtMs) : undefined,
    };
  }

  async listCronJobs(agentId?: string): Promise<CronJobInfo[]> {
    if (!this.cronService) {
      return [];
    }
    return this.cronService.listJobs({ agentId, includeDisabled: true });
  }

  async removeCronJob(jobId: string): Promise<boolean> {
    if (!this.cronService) {
      return false;
    }
    return this.cronService.removeJob(jobId);
  }

  async updateCronJob(jobId: string, enabled: boolean): Promise<boolean> {
    if (!this.cronService) {
      return false;
    }
    const job = await this.cronService.updateJob(jobId, { enabled });
    return job !== null;
  }

  async updateCronJobFull(
    jobId: string,
    updates: {
      name?: string;
      message?: string;
      schedule?: CronSchedule;
      enabled?: boolean;
      payload?: { kind: "agentTurn"; message: string } | { kind: "systemEvent"; text: string };
    },
  ): Promise<boolean> {
    if (!this.cronService) {
      return false;
    }

    const updateInput: any = {};
    if (updates.name !== undefined) updateInput.name = updates.name;
    if (updates.enabled !== undefined) updateInput.enabled = updates.enabled;
    if (updates.schedule !== undefined) updateInput.schedule = updates.schedule;
    if (updates.message !== undefined) {
      updateInput.payload = { kind: "agentTurn", message: updates.message };
    }
    if (updates.payload !== undefined) {
      updateInput.payload = updates.payload;
    }

    const job = await this.cronService.updateJob(jobId, updateInput);
    return job !== null;
  }
}
