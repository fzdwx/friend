import { describe, test, expect, beforeEach } from "bun:test";
import { SystemEventQueue, globalSystemEventQueue } from "./system-events.js";

// ─── Tests ────────────────────────────────────────────────────────

describe("SystemEventQueue", () => {
  let queue: SystemEventQueue;

  beforeEach(() => {
    queue = new SystemEventQueue();
  });

  describe("enqueue", () => {
    test("adds event to queue", () => {
      queue.enqueue("agent-1", "Test event");
      
      expect(queue.has("agent-1")).toBe(true);
      expect(queue.count("agent-1")).toBe(1);
    });

    test("trims whitespace from event text", () => {
      queue.enqueue("agent-1", "  Test event  ");
      
      const events = queue.drain("agent-1");
      expect(events[0].text).toBe("Test event");
    });

    test("ignores empty events", () => {
      queue.enqueue("agent-1", "");
      queue.enqueue("agent-1", "   ");
      
      expect(queue.has("agent-1")).toBe(false);
    });

    test("deduplicates consecutive identical events", () => {
      queue.enqueue("agent-1", "Event 1");
      queue.enqueue("agent-1", "Event 1");
      queue.enqueue("agent-1", "Event 2");
      
      expect(queue.count("agent-1")).toBe(2);
    });

    test("allows same event after different event", () => {
      queue.enqueue("agent-1", "Event 1");
      queue.enqueue("agent-1", "Event 2");
      queue.enqueue("agent-1", "Event 1");
      
      expect(queue.count("agent-1")).toBe(3);
    });

    test("enforces max limit (20 events)", () => {
      for (let i = 0; i < 25; i++) {
        queue.enqueue("agent-1", `Event ${i}`);
      }
      
      expect(queue.count("agent-1")).toBe(20);
    });

    test("removes oldest events when limit exceeded", () => {
      for (let i = 0; i < 25; i++) {
        queue.enqueue("agent-1", `Event ${i}`);
      }
      
      const events = queue.drain("agent-1");
      expect(events[0].text).toBe("Event 5");  // First 5 were removed
      expect(events[events.length - 1].text).toBe("Event 24");
    });

    test("maintains separate queues per agent", () => {
      queue.enqueue("agent-1", "Event for agent 1");
      queue.enqueue("agent-2", "Event for agent 2");
      
      expect(queue.count("agent-1")).toBe(1);
      expect(queue.count("agent-2")).toBe(1);
    });

    test("stores timestamp for each event", () => {
      const before = Date.now();
      queue.enqueue("agent-1", "Test event");
      const after = Date.now();
      
      const events = queue.drain("agent-1");
      expect(events[0].ts).toBeGreaterThanOrEqual(before);
      expect(events[0].ts).toBeLessThanOrEqual(after);
    });
  });

  describe("drain", () => {
    test("returns empty array for non-existent agent", () => {
      const events = queue.drain("non-existent");
      expect(events).toEqual([]);
    });

    test("returns empty array for empty queue", () => {
      queue.enqueue("agent-1", "Event");
      queue.drain("agent-1");
      
      const events = queue.drain("agent-1");
      expect(events).toEqual([]);
    });

    test("returns all events and clears queue", () => {
      queue.enqueue("agent-1", "Event 1");
      queue.enqueue("agent-1", "Event 2");
      queue.enqueue("agent-1", "Event 3");
      
      const events = queue.drain("agent-1");
      
      expect(events.length).toBe(3);
      expect(queue.has("agent-1")).toBe(false);
      expect(queue.count("agent-1")).toBe(0);
    });

    test("clears lastText after draining", () => {
      queue.enqueue("agent-1", "Event 1");
      queue.drain("agent-1");
      
      // Should allow same event again after drain
      queue.enqueue("agent-1", "Event 1");
      expect(queue.count("agent-1")).toBe(1);
    });

    test("removes queue entry after draining", () => {
      queue.enqueue("agent-1", "Event 1");
      queue.drain("agent-1");
      
      queue.enqueue("agent-1", "Event 2");
      const events = queue.drain("agent-1");
      
      expect(events.length).toBe(1);
      expect(events[0].text).toBe("Event 2");
    });
  });

  describe("has", () => {
    test("returns false for non-existent agent", () => {
      expect(queue.has("non-existent")).toBe(false);
    });

    test("returns false after drain", () => {
      queue.enqueue("agent-1", "Event");
      queue.drain("agent-1");
      
      expect(queue.has("agent-1")).toBe(false);
    });

    test("returns true when events exist", () => {
      queue.enqueue("agent-1", "Event");
      expect(queue.has("agent-1")).toBe(true);
    });
  });

  describe("peek", () => {
    test("returns empty array for non-existent agent", () => {
      expect(queue.peek("non-existent")).toEqual([]);
    });

    test("returns event texts without draining", () => {
      queue.enqueue("agent-1", "Event 1");
      queue.enqueue("agent-1", "Event 2");
      
      const texts = queue.peek("agent-1");
      
      expect(texts).toEqual(["Event 1", "Event 2"]);
      expect(queue.count("agent-1")).toBe(2);
    });
  });

  describe("clear", () => {
    test("removes all events for agent", () => {
      queue.enqueue("agent-1", "Event 1");
      queue.enqueue("agent-1", "Event 2");
      
      queue.clear("agent-1");
      
      expect(queue.has("agent-1")).toBe(false);
      expect(queue.count("agent-1")).toBe(0);
    });

    test("does not affect other agents", () => {
      queue.enqueue("agent-1", "Event 1");
      queue.enqueue("agent-2", "Event 2");
      
      queue.clear("agent-1");
      
      expect(queue.has("agent-1")).toBe(false);
      expect(queue.has("agent-2")).toBe(true);
    });

    test("is safe to call on non-existent agent", () => {
      queue.clear("non-existent");
      // Should not throw
    });
  });

  describe("count", () => {
    test("returns 0 for non-existent agent", () => {
      expect(queue.count("non-existent")).toBe(0);
    });

    test("returns correct count", () => {
      queue.enqueue("agent-1", "Event 1");
      queue.enqueue("agent-1", "Event 2");
      
      expect(queue.count("agent-1")).toBe(2);
    });

    test("updates after drain", () => {
      queue.enqueue("agent-1", "Event");
      queue.drain("agent-1");
      
      expect(queue.count("agent-1")).toBe(0);
    });
  });

  describe("formatAsContext", () => {
    test("returns empty string for empty events", () => {
      const result = SystemEventQueue.formatAsContext([]);
      expect(result).toBe("");
    });

    test("formats single event", () => {
      const events = [{ text: "Test event", ts: 1000000000000 }];
      const result = SystemEventQueue.formatAsContext(events);
      
      expect(result).toContain("系统事件提醒");
      expect(result).toContain("Test event");
      expect(result).toContain("[1]");
    });

    test("formats multiple events", () => {
      const events = [
        { text: "Event 1", ts: 1000000000000 },
        { text: "Event 2", ts: 1000000001000 },
      ];
      const result = SystemEventQueue.formatAsContext(events);
      
      expect(result).toContain("[1]");
      expect(result).toContain("[2]");
      expect(result).toContain("Event 1");
      expect(result).toContain("Event 2");
    });

    test("includes action prompt", () => {
      const events = [{ text: "Test", ts: 1000000000000 }];
      const result = SystemEventQueue.formatAsContext(events);
      
      expect(result).toContain("请根据上述事件采取行动");
    });
  });
});

describe("globalSystemEventQueue", () => {
  test("is a SystemEventQueue instance", () => {
    expect(globalSystemEventQueue).toBeInstanceOf(SystemEventQueue);
  });

  test("can enqueue and drain events", () => {
    // Use unique agent ID to avoid conflicts
    const testId = `test-${Date.now()}`;
    globalSystemEventQueue.enqueue(testId, "Global event");
    
    expect(globalSystemEventQueue.has(testId)).toBe(true);
    
    const events = globalSystemEventQueue.drain(testId);
    expect(events.length).toBe(1);
    expect(events[0].text).toBe("Global event");
  });
});
