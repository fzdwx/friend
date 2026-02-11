import { Elysia } from "elysia";
import { getAgentManager } from "../agent/manager.js";
import type { ModelInfo } from "@friend/shared";

export const modelRoutes = new Elysia({ prefix: "/api" }).get("/models", async () => {
  try {
    const models = await getAgentManager().getModels();
    return { ok: true, data: models };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
