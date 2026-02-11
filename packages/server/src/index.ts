import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { initAgentManager } from "./agent/manager";
import { sessionRoutes } from "./routes/sessions";
import { modelRoutes } from "./routes/models";
import { configRoutes } from "./routes/config";
import { eventRoutes } from "./routes/events";

await initAgentManager();

const app = new Elysia()
  .use(cors())
  .use(sessionRoutes)
  .use(modelRoutes)
  .use(configRoutes)
  .use(eventRoutes)
  .listen(3001);

console.log(`Friend server running at http://localhost:3001`);
