import { Elysia, sse } from "elysia";
import { getAgentManager } from "../agent/manager";
import type { GlobalSSEEvent } from "@friend/shared";

const HEARTBEAT_INTERVAL = 15_000; // 15 seconds

export const eventRoutes = new Elysia().get("/api/events", async function* () {
  // Yield immediately so Elysia flushes SSE response headers
  yield sse({ event: "connected", data: "{}" });

  const subscriber = getAgentManager().subscribe();
  const iterator = subscriber[Symbol.asyncIterator]();

  // Track the pending .next() call so it survives across heartbeat cycles
  let pending: Promise<IteratorResult<GlobalSSEEvent>> | null = null;

  try {
    while (true) {
      if (!pending) {
        pending = iterator.next();
      }

      const result = await Promise.race([
        pending,
        new Promise<"heartbeat">((r) => setTimeout(() => r("heartbeat"), HEARTBEAT_INTERVAL)),
      ]);

      if (result === "heartbeat") {
        // Keep the connection alive; pending stays active for the next iteration
        yield sse({ event: "ping", data: "{}" });
        continue;
      }

      pending = null;
      if (result.done) break;
      yield sse({ event: result.value.type, data: JSON.stringify(result.value) });
    }
  } finally {
    subscriber.close();
  }
});
