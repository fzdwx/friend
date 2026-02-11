import { Elysia, t } from "elysia";
import { getAgentManager } from "../agent/manager";

const CustomModelSchema = t.Object({
  id: t.String(),
  name: t.String(),
  reasoning: t.Boolean(),
  contextWindow: t.Number(),
  maxTokens: t.Number(),
  cost: t.Object({
    input: t.Number(),
    output: t.Number(),
    cacheRead: t.Number(),
    cacheWrite: t.Number(),
  }),
});

const CustomProviderSchema = t.Object({
  name: t.String(),
  baseUrl: t.String(),
  apiKey: t.Optional(t.String()),
  api: t.Optional(t.String()),
  headers: t.Optional(t.Record(t.String(), t.String())),
  models: t.Array(CustomModelSchema),
});

export const configRoutes = new Elysia({ prefix: "/api/config" })
  .get("/", () => {
    return { ok: true, data: getAgentManager().getConfig() };
  })

  // Custom provider management
  .get("/providers", () => {
    return { ok: true, data: getAgentManager().getCustomProviders() };
  })

  .post(
    "/providers",
    ({ body }) => {
      getAgentManager().addCustomProvider(body as any);
      return { ok: true };
    },
    { body: CustomProviderSchema },
  )

  .delete("/providers/:name", async ({ params: { name } }) => {
    const ok = await getAgentManager().removeCustomProvider(name);
    if (!ok) return { ok: false, error: "Provider not found" };
    return { ok: true };
  });
