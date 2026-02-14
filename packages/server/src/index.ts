import { DB_PATH } from "./agent/paths.js";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${DB_PATH}`;
}

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { initAgentManager } from "./agent/manager";
import { ensureBuiltinSkills } from "./agent/builtin-skills/index.js";
import { sessionRoutes } from "./routes/sessions";
import { configRoutes } from "./routes/config";
import { eventRoutes } from "./routes/events";
import { modelRoutes } from "./routes/models";
import { skillRoutes } from "./routes/skills";
import { agentsRoutes, bindingsRoutes } from "./routes/agents.js";

// Ensure built-in skills exist
ensureBuiltinSkills();

await initAgentManager();

const app = new Elysia()
  .use(cors())
  .use(sessionRoutes)
  .use(configRoutes)
  .use(eventRoutes)
  .use(modelRoutes)
  .use(skillRoutes)
  .use(agentsRoutes)
  .use(bindingsRoutes)
  .listen(3001);

console.log(`Friend server running at http://localhost:3001`);
