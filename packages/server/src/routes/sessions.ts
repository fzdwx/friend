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
    { body: t.Object({ name: t.Optional(t.String()), workingPath: t.Optional(t.String()) }) },
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

  .get("/:id/stats", ({ params: { id } }) => {
    const stats = getAgentManager().getStats(id);
    if (!stats) return { ok: false, error: "Session not found" };
    return { ok: true, data: stats };
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
  );
