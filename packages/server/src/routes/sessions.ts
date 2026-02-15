import { Elysia, t } from "elysia";
import { getAgentManager } from "../agent/manager.js";

export const sessionRoutes = new Elysia({ prefix: "/api/sessions" })
  .get("/", async () => {
    return { ok: true, data: await getAgentManager().listSessions() };
  })

  .post(
    "/",
    async ({ body }) => {
      try {
        const session = await getAgentManager().createSession(body);
        return { ok: true, data: session };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    { body: t.Object({ name: t.Optional(t.String()), workingPath: t.Optional(t.String()), agentId: t.Optional(t.String()) }) },
  )

  .get("/:id", async ({ params: { id } }) => {
    const session = await getAgentManager().getSession(id);
    if (!session) return { ok: false, error: "Session not found" };
    return { ok: true, data: session };
  })

  .delete("/:id", async ({ params: { id } }) => {
    const ok = await getAgentManager().deleteSession(id);
    if (!ok) return { ok: false, error: "Session not found" };
    return { ok: true };
  })

  .post(
    "/:id/prompt",
    async ({ params: { id }, body }) => {
      try {
        await getAgentManager().prompt(id, body.message);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    { body: t.Object({ message: t.String() }) },
  )

  .post(
    "/:id/steer",
    async ({ params: { id }, body }) => {
      try {
        await getAgentManager().steer(id, body.message);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    { body: t.Object({ message: t.String() }) },
  )

  .post(
    "/:id/followUp",
    async ({ params: { id }, body }) => {
      try {
        await getAgentManager().followUp(id, body.message);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    { body: t.Object({ message: t.String() }) },
  )

  .post("/:id/abort", async ({ params: { id } }) => {
    try {
      await getAgentManager().abort(id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  })

  .post("/:id/compact", async ({ params: { id } }) => {
    try {
      await getAgentManager().compact(id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  })

  .post("/:id/refresh-context", ({ params: { id } }) => {
    const ok = getAgentManager().refreshContext(id);
    if (!ok) return { ok: false, error: "Session not found" };
    return { ok: true };
  })

  .get("/:id/stats", ({ params: { id } }) => {
    const stats = getAgentManager().getStats(id);
    if (!stats) return { ok: false, error: "Session not found" };
    return { ok: true, data: stats };
  })

  .get("/:id/context", ({ params: { id } }) => {
    const context = getAgentManager().getContextUsage(id);
    if (!context) return { ok: false, error: "Session not found or no context" };
    return { ok: true, data: context };
  })

  .get("/:id/pending", ({ params: { id } }) => {
    const pending = getAgentManager().getPendingMessages(id);
    if (!pending) return { ok: false, error: "Session not found" };
    return { ok: true, data: pending };
  })

  .delete("/:id", async ({ params: { id } }) => {
    const ok = await getAgentManager().deleteSession(id);
    if (!ok) return { ok: false, error: "Session not found" };
    return { ok: true };
  })

  .patch(
    "/:id/name",
    async ({ params: { id }, body }) => {
      try {
        const ok = await getAgentManager().renameSession(id, body.name);
        return { ok };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    { body: t.Object({ name: t.String() }) },
  )

  .post(
    "/:id/model",
    async ({ params: { id }, body }) => {
      try {
        const ok = await getAgentManager().setModel(id, body.provider, body.modelId);
        if (!ok) return { ok: false, error: "Session or model not found" };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    { body: t.Object({ provider: t.String(), modelId: t.String() }) },
  )

  // Plan mode actions
  .post(
    "/:id/plan-action",
    async ({ params: { id }, body }) => {
      try {
        await getAgentManager().planAction(id, body.action, {
          todos: body.todos,
          message: body.message,
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    {
      body: t.Object({
        action: t.Union([t.Literal("execute"), t.Literal("cancel"), t.Literal("modify")]),
        todos: t.Optional(t.Array(t.Object({
          step: t.Number(),
          text: t.String(),
          completed: t.Boolean(),
        }))),
        message: t.Optional(t.String()),
      }),
    },
  )

  .get("/:id/plan", ({ params: { id } }) => {
    const plan = getAgentManager().getPlanModeInfo(id);
    if (!plan) return { ok: false, error: "Session not found" };
    return { ok: true, data: plan };
  })

  // Slash commands - get available commands
  .get("/:id/commands", ({ params: { id } }) => {
    const commands = getAgentManager().getCommands(id);
    return { ok: true, data: commands };
  })

  // Slash commands - execute a command
  .post(
    "/:id/command",
    async ({ params: { id }, body }) => {
      try {
        await getAgentManager().executeCommand(id, body.name, body.args);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        args: t.Optional(t.String()),
      }),
    },
  )

  // Question tool - answer questionnaire
  .post(
    "/:id/answer-question",
    async ({ params: { id }, body }) => {
      try {
        const ok = getAgentManager().resolveQuestionnaire(
          id,
          body.answers ?? [],
          body.cancelled ?? false,
        );
        if (!ok) return { ok: false, error: "No pending questionnaire for this session" };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    {
      body: t.Object({
        answers: t.Optional(t.Array(t.Object({
          questionId: t.String(),
          answers: t.Array(t.String()),
          wasCustom: t.Optional(t.Boolean()),
        }))),
        cancelled: t.Optional(t.Boolean()),
      }),
    },
  );
