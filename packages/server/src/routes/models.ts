import { Elysia, t } from "elysia";
import { getAgentManager } from "../agent/manager";

export const modelRoutes = new Elysia({ prefix: "/api" })
  .get("/models", async () => {
    const models = await getAgentManager().getModels();
    return { ok: true, data: models };
  })

  .post(
    "/sessions/:id/model",
    async ({ params: { id }, body }) => {
      const ok = await getAgentManager().setModel(id, body.provider, body.modelId);
      if (!ok) return { ok: false, error: "Model not found or session not found" };
      return { ok: true };
    },
    {
      body: t.Object({
        provider: t.String(),
        modelId: t.String(),
      }),
    },
  )

  .post(
    "/sessions/:id/thinking",
    async ({ params: { id }, body }) => {
      const ok = getAgentManager().setThinkingLevel(id, body.level as any);
      if (!ok) return { ok: false, error: "Session not found" };
      return { ok: true };
    },
    {
      body: t.Object({
        level: t.String(),
      }),
    },
  );
