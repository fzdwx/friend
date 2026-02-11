import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { initAgentManager } from "./agent/manager";
import { sessionRoutes } from "./routes/sessions";
import { configRoutes } from "./routes/config";
import { eventRoutes } from "./routes/events";

await initAgentManager();

const app = new Elysia()
  .use(cors())
  .use(sessionRoutes)
  .use(configRoutes)
  .use(eventRoutes)
  .listen(3001);

console.log(`Friend server running at http://localhost:3001`);
