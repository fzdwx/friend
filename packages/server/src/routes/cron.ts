/**
 * Cron Job Management Routes
 */

import { Elysia, t } from "elysia";
import { getAgentManager } from "../agent/manager";

// Schema for cron schedule (input uses seconds for user-friendliness)
const CronScheduleInputSchema = t.Union([
  t.Object({
    kind: t.Literal("at"),
    at_seconds: t.Number(),
  }),
  t.Object({
    kind: t.Literal("every"),
    every_seconds: t.Number(),
  }),
  t.Object({
    kind: t.Literal("cron"),
    expr: t.String(),
  }),
]);

// Schema for creating a cron job
const CreateCronJobSchema = t.Object({
  agentId: t.String(),
  name: t.String(),
  schedule: CronScheduleInputSchema,
  message: t.String(),
});

// Schema for updating a cron job
const UpdateCronJobSchema = t.Object({
  name: t.Optional(t.String()),
  message: t.Optional(t.String()),
  schedule: t.Optional(CronScheduleInputSchema),
  enabled: t.Optional(t.Boolean()),
});

// Convert input schedule (seconds) to internal schedule (milliseconds)
function toInternalSchedule(schedule: any): any {
  switch (schedule.kind) {
    case "at":
      return { kind: "at", atMs: schedule.at_seconds * 1000 };
    case "every":
      return { kind: "every", everyMs: schedule.every_seconds * 1000 };
    case "cron":
      return { kind: "cron", expr: schedule.expr };
  }
}

export const cronRoutes = new Elysia({ prefix: "/api/cron" })
  // List all cron jobs (optionally filtered by agentId)
  .get("/", async ({ query }) => {
    const agentId = query.agentId as string | undefined;
    const jobs = await getAgentManager().listCronJobs(agentId);
    return { ok: true, data: jobs };
  })

  // Add a new cron job
  .post(
    "/",
    async ({ body }) => {
      const { agentId, name, schedule, message } = body;
      const internalSchedule = toInternalSchedule(schedule);
      const result = await getAgentManager().addCronJob(
        agentId,
        name,
        internalSchedule,
        message,
      );
      return { ok: true, data: result };
    },
    { body: CreateCronJobSchema },
  )

  // Get a specific cron job
  .get("/:id", async ({ params: { id } }) => {
    const jobs = await getAgentManager().listCronJobs();
    const job = jobs.find((j) => j.id === id);
    if (!job) return { ok: false, error: "Cron job not found" };
    return { ok: true, data: job };
  })

  // Update a cron job
  .patch(
    "/:id",
    async ({ params: { id }, body }) => {
      const updates: any = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.enabled !== undefined) updates.enabled = body.enabled;
      if (body.schedule !== undefined) {
        updates.schedule = toInternalSchedule(body.schedule);
      }
      if (body.message !== undefined) {
        updates.payload = { kind: "agentTurn", message: body.message };
      }
      const ok = await getAgentManager().updateCronJobFull(id, updates);
      if (!ok) return { ok: false, error: "Cron job not found or update failed" };
      return { ok: true };
    },
    { body: UpdateCronJobSchema },
  )

  // Enable/disable a cron job
  .patch(
    "/:id/enabled",
    async ({ params: { id }, body }) => {
      const ok = await getAgentManager().updateCronJob(id, body.enabled);
      if (!ok) return { ok: false, error: "Cron job not found or update failed" };
      return { ok: true };
    },
    { body: t.Object({ enabled: t.Boolean() }) },
  )

  // Delete a cron job
  .delete("/:id", async ({ params: { id } }) => {
    const ok = await getAgentManager().removeCronJob(id);
    if (!ok) return { ok: false, error: "Cron job not found" };
    return { ok: true };
  });
