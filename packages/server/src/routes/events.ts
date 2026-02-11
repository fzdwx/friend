import { Elysia } from "elysia";
import { getAgentManager } from "../agent/manager";

export const eventRoutes = new Elysia().get(
  "/api/sessions/:id/events",
  async function* ({ params: { id } }) {
    const subscriber = getAgentManager().subscribe(id);
    try {
      for await (const event of subscriber) {
        yield { event: event.type, data: JSON.stringify(event) };
      }
    } finally {
      subscriber.close();
    }
  },
);
