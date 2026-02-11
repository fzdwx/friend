import { Elysia, sse } from "elysia";
import { getAgentManager } from "../agent/manager";

export const eventRoutes = new Elysia().get("/api/events", async function* () {
  // Yield immediately so Elysia flushes SSE response headers
  yield sse({ event: "connected", data: "{}" });

  const subscriber = getAgentManager().subscribe();
  try {
    for await (const event of subscriber) {
      yield sse({ event: event.type, data: JSON.stringify(event) });
    }
  } finally {
    subscriber.close();
  }
});
