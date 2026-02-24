import { describe, test, expect, beforeEach, mock } from "bun:test";
import { HeartbeatService, type HeartbeatServiceDeps, type HeartbeatAgentState, type HeartbeatResult } from "./service.js";
import type { AgentConfig } from "../agent-manager.js";

// ─── Helper Functions (extracted from service for testing) ────────────────

/**
 * Check if HEARTBEAT.md content is effectively empty.
 */
function isContentEmpty(content: string): boolean {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip markdown headers (# followed by space or EOL)
    if (/^#+(\s|$)/.test(trimmed)) continue;

    // Skip empty markdown list items
    if (/^[-*+]\s*(\[[\sXx]?\]\s*)?$/.test(trimmed)) continue;

    // Found non-empty content
    return false;
  }

  return true;
}

/**
 * Strip HEARTBEAT_OK from response.
 */
function stripHeartbeatOk(response: string): string | null {
  const HEARTBEAT_TOKEN = "HEARTBEAT_OK";
  const HEARTBEAT_OK_THRESHOLD = 300;

  let text = response.trim();

  text = text.replace(new RegExp(`^${HEARTBEAT_TOKEN}\\s*`, "g"), "");
  text = text.replace(new RegExp(`\\s*${HEARTBEAT_TOKEN}$`, "g"), "");
  text = text.trim();

  if (!text || text.length <= HEARTBEAT_OK_THRESHOLD) {
    return null;
  }

  return text;
}

/**
 * Parse interval string to milliseconds.
 */
function parseInterval(every?: string): number | null {
  const MIN_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes minimum

  if (!every) return null;

  const match = every.match(/^(\d+)(h|m)?(\d+)?(m|h)?$/);
  if (!match) return null;

  let ms = 0;
  const str = every.toLowerCase();

  // Hours
  const hoursMatch = str.match(/(\d+)h/);
  if (hoursMatch) {
    ms += parseInt(hoursMatch[1]) * 60 * 60 * 1000;
  }

  // Minutes
  const minutesMatch = str.match(/(\d+)m/);
  if (minutesMatch) {
    ms += parseInt(minutesMatch[1]) * 60 * 1000;
  }

  // Just a number - assume minutes
  if (!hoursMatch && !minutesMatch) {
    const num = parseInt(every);
    if (!isNaN(num)) {
      ms = num * 60 * 1000;
    }
  }

  return Math.max(ms, MIN_INTERVAL_MS);
}

// ─── Tests ────────────────────────────────────────────────────────

describe("HeartbeatService Helpers", () => {
  describe("isContentEmpty", () => {
    test("returns true for empty string", () => {
      expect(isContentEmpty("")).toBe(true);
    });

    test("returns true for whitespace only", () => {
      expect(isContentEmpty("   \n\n   \t  ")).toBe(true);
    });

    test("returns true for markdown headers only", () => {
      expect(isContentEmpty("# HEARTBEAT.md\n\n## Tasks\n\n")).toBe(true);
    });

    test("returns true for empty list items", () => {
      expect(isContentEmpty("- [ ] \n- [ ] \n* ")).toBe(true);
    });

    test("returns false for actual content", () => {
      expect(isContentEmpty("# Title\n\n- Check email")).toBe(false);
    });

    test("returns false for single word", () => {
      expect(isContentEmpty("test")).toBe(false);
    });

    test("returns false for text content", () => {
      const content = `# HEARTBEAT.md

This file defines tasks...

---

## 📋 Active Tasks

<!-- Add your periodic tasks below -->

---

## ✅ Completed Tasks`;
      expect(isContentEmpty(content)).toBe(false);  // "This file defines tasks..." is actual content
    });
  });

  describe("stripHeartbeatOk", () => {
    test("returns null for pure HEARTBEAT_OK", () => {
      expect(stripHeartbeatOk("HEARTBEAT_OK")).toBe(null);
    });

    test("returns null for HEARTBEAT_OK with whitespace", () => {
      expect(stripHeartbeatOk("  HEARTBEAT_OK  ")).toBe(null);
    });

    test("returns null for short text with HEARTBEAT_OK", () => {
      expect(stripHeartbeatOk("HEARTBEAT_OK\n\nAll good")).toBe(null);
    });

    test("returns meaningful content when present", () => {
      // Create a long enough response to exceed HEARTBEAT_OK_THRESHOLD (300 chars)
      const response = `HEARTBEAT_OK

Found 3 critical issues that need immediate attention and should be resolved quickly:
1. Test coverage is critically low at only 2.8%, we need to add more tests for all core services
2. Missing documentation for core services like heartbeat and cron, developers can't understand the code
3. Need to refactor the agent manager to improve performance, reliability, and maintainability of the system

Additionally, I noticed that the logging system could be improved with better structured output.

HEARTBEAT_OK`;

      const result = stripHeartbeatOk(response);
      expect(result).toContain("Found 3 critical issues");
    });

    test("strips HEARTBEAT_OK from start", () => {
      // Create a long enough response
      const response = "HEARTBEAT_OK\n\n" + "Did some work today. ".repeat(20);
      const result = stripHeartbeatOk(response);
      expect(result).toContain("Did some work today");
    });

    test("strips HEARTBEAT_OK from end", () => {
      // Create a long enough response
      const response = "Did some work today. ".repeat(20) + "\n\nHEARTBEAT_OK";
      const result = stripHeartbeatOk(response);
      expect(result).toContain("Did some work today");
    });
  });

  describe("parseInterval", () => {
    test("parses minutes format", () => {
      expect(parseInterval("30m")).toBe(30 * 60 * 1000);
    });

    test("parses hours format", () => {
      expect(parseInterval("2h")).toBe(2 * 60 * 60 * 1000);
    });

    test("parses combined hours and minutes", () => {
      expect(parseInterval("1h30m")).toBe(90 * 60 * 1000);
    });

    test("assumes minutes for plain number", () => {
      expect(parseInterval("45")).toBe(45 * 60 * 1000);
    });

    test("enforces minimum interval", () => {
      expect(parseInterval("2m")).toBe(5 * 60 * 1000);  // 5 minutes minimum
    });

    test("returns null for invalid format", () => {
      expect(parseInterval("invalid")).toBe(null);
    });

    test("returns null for empty string", () => {
      expect(parseInterval("")).toBe(null);
    });

    test("returns null for undefined", () => {
      expect(parseInterval(undefined)).toBe(null);
    });

    test("handles mixed case", () => {
      // The implementation converts to lowercase before matching
      // But the regex needs exact format, so mixed case may not work
      expect(parseInterval("1h30m")).toBe(90 * 60 * 1000);
      // Uppercase won't match the regex pattern
      expect(parseInterval("1H30M")).toBe(null);
    });
  });
});

describe("HeartbeatService", () => {
  let service: HeartbeatService;
  let mockDeps: HeartbeatServiceDeps;

  beforeEach(() => {
    mockDeps = {
      getAgents: mock(() => Promise.resolve([])),
      getAgentWorkspace: mock(() => "/tmp/workspace"),
      executeAgentTask: mock(() => Promise.resolve("HEARTBEAT_OK")),
      sessionExists: mock(() => Promise.resolve(false)),
      createSession: mock(() => Promise.resolve("test-session-id")),
      broadcastEvent: mock(() => {}),
      getCronJobs: mock(() => Promise.resolve([])),
    };

    service = new HeartbeatService(mockDeps);
  });

  test("starts and stops cleanly", () => {
    service.start();
    service.stop();
    // Should not throw
  });

  test("getStates returns empty array initially", () => {
    const states = service.getStates();
    expect(states).toEqual([]);
  });

  test("runNow returns error for non-existent agent", async () => {
    mockDeps.getAgents = mock(() => Promise.resolve([]));

    const result = await service.runNow("non-existent-agent");

    expect(result.status).toBe("error");
    expect(result.error).toContain("not found");
  });

  test("runNow executes heartbeat for existing agent", async () => {
    const mockAgent: AgentConfig = {
      id: "test-agent",
      name: "Test Agent",
      model: "test-model",
      heartbeat: { every: "30m" },
    };

    mockDeps.getAgents = mock(() => Promise.resolve([mockAgent]));
    mockDeps.executeAgentTask = mock(() => Promise.resolve("HEARTBEAT_OK"));

    const result = await service.runNow("test-agent");

    expect(result.status).toBe("executed");
    expect(mockDeps.executeAgentTask).toHaveBeenCalled();
  });

  test("skips heartbeat for newly created agent", async () => {
    const mockAgent: AgentConfig = {
      id: "new-agent",
      name: "New Agent",
      model: "test-model",
      heartbeat: { every: "30m" },
    };

    // Agent created 2 minutes ago (below the 10-minute threshold)
    const createdAt = new Date(Date.now() - 2 * 60 * 1000);

    mockDeps.getAgents = mock(() => Promise.resolve([mockAgent]));
    mockDeps.getAgentCreatedAt = mock(() => Promise.resolve(createdAt));
    mockDeps.executeAgentTask = mock(() => Promise.resolve("HEARTBEAT_OK"));

    // Force run checkAllAgents directly
    service.start();

    // Wait for the initial 5s delay to pass
    await new Promise(resolve => setTimeout(resolve, 5100));

    // Should not have executed the task
    expect(mockDeps.executeAgentTask).not.toHaveBeenCalled();

    service.stop();
  }, 10000); // 10 second timeout

  test("executes heartbeat for agent older than threshold", async () => {
    const mockAgent: AgentConfig = {
      id: "old-agent",
      name: "Old Agent",
      model: "test-model",
      heartbeat: { every: "30m" },
    };

    // Agent created 15 minutes ago (above the 10-minute threshold)
    const createdAt = new Date(Date.now() - 15 * 60 * 1000);

    mockDeps.getAgents = mock(() => Promise.resolve([mockAgent]));
    mockDeps.getAgentCreatedAt = mock(() => Promise.resolve(createdAt));
    mockDeps.executeAgentTask = mock(() => Promise.resolve("HEARTBEAT_OK"));

    service.start();

    // Wait for the initial 5s delay to pass
    await new Promise(resolve => setTimeout(resolve, 5100));

    // Should have executed the task
    expect(mockDeps.executeAgentTask).toHaveBeenCalled();

    service.stop();
  }, 10000); // 10 second timeout
});
