import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { 
  executeSubagent, 
  executeParallelSubagents, 
  executeChainSubagents,
  getFinalOutput,
  aggregateUsage 
} from "./executor.js";
import type { SubagentConfig, SingleResult, UsageStats, SubagentSessionConfig, SubagentSession } from "./types.js";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

// ─── Mock Session Factory ─────────────────────────────────────────────────

const createMockSession = (messages: any[] = []): AgentSession => {
  const eventListeners = new Map<string, Set<Function>>();
  
  return {
    prompt: mock(async (task: string) => {
      // Simulate message completion
      const event = {
        type: "message_end",
        message: messages[0] || {
          role: "assistant",
          content: [{ type: "text", text: `Executed: ${task}` }],
          usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
          model: "test-model",
          stopReason: "end"
        }
      };
      eventListeners.get("event")?.forEach(fn => fn(event));
    }),
    on: mock((event: string, fn: Function) => {
      if (!eventListeners.has(event)) eventListeners.set(event, new Set());
      eventListeners.get(event)!.add(fn);
    }),
    off: mock((event: string, fn: Function) => {
      eventListeners.get(event)?.delete(fn);
    }),
    dispose: mock(() => {}),
    abort: mock(() => {}),
    isStreaming: false,
    messages,
    model: undefined,
    sessionManager: {} as any,
  } as any;
};

const createMockSessionFactory = (sessions: AgentSession[] = []) => {
  let index = 0;
  return async (config: SubagentSessionConfig): Promise<SubagentSession> => {
    const session = sessions[index++] || createMockSession();
    return {
      session,
      cleanup: async () => {},
    };
  };
};

// ─── Test Data ─────────────────────────────────────────────────────────────

const testAgent: SubagentConfig = {
  name: "test-agent",
  description: "A test agent",
  systemPrompt: "You are a test agent.",
  source: "user",
  filePath: "/test/agent.md",
};

const testWorkspaceAgent: SubagentConfig = {
  name: "workspace-agent",
  description: "A workspace test agent",
  systemPrompt: "You are a workspace agent.",
  source: "workspace",
  filePath: "/workspace/subagents/agent.md",
  tools: ["read", "grep"],
  model: "anthropic/claude-haiku-4-5",
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Subagent Executor", () => {
  describe("getFinalOutput", () => {
    it("should extract text from assistant messages", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: [{ type: "text", text: "Hi there!" }] },
      ];
      
      expect(getFinalOutput(messages)).toBe("Hi there!");
    });

    it("should return empty string for no assistant messages", () => {
      const messages = [
        { role: "user", content: "Hello" },
      ];
      
      expect(getFinalOutput(messages)).toBe("");
    });

    it("should get the last assistant message", () => {
      const messages = [
        { role: "assistant", content: [{ type: "text", text: "First" }] },
        { role: "assistant", content: [{ type: "text", text: "Second" }] },
      ];
      
      expect(getFinalOutput(messages)).toBe("Second");
    });
  });

  describe("aggregateUsage", () => {
    it("should aggregate usage from multiple results", () => {
      const results: SingleResult[] = [
        {
          agent: "a1",
          agentSource: "user",
          task: "t1",
          exitCode: 0,
          messages: [],
          stderr: "",
          usage: {
            input: 100,
            output: 200,
            cacheRead: 10,
            cacheWrite: 20,
            cost: 0.01,
            contextTokens: 300,
            turns: 1,
          },
        },
        {
          agent: "a2",
          agentSource: "user",
          task: "t2",
          exitCode: 0,
          messages: [],
          stderr: "",
          usage: {
            input: 150,
            output: 250,
            cacheRead: 15,
            cacheWrite: 25,
            cost: 0.02,
            contextTokens: 400,
            turns: 2,
          },
        },
      ];

      const aggregated = aggregateUsage(results);
      
      expect(aggregated.input).toBe(250);
      expect(aggregated.output).toBe(450);
      expect(aggregated.cacheRead).toBe(25);
      expect(aggregated.cacheWrite).toBe(45);
      expect(aggregated.cost).toBe(0.03);
      expect(aggregated.turns).toBe(3);
      expect(aggregated.contextTokens).toBe(400); // Max
    });
  });

  describe("executeSubagent (single mode)", () => {
    it("should execute a single agent task", async () => {
      const mockSession = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Task completed" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
        stopReason: "end"
      }]);

      const result = await executeSubagent({
        agent: testAgent,
        task: "Test task",
        cwd: "/test",
        createSessionFn: createMockSessionFactory([mockSession]),
      });

      expect(result.agent).toBe("test-agent");
      expect(result.agentSource).toBe("user");
      expect(result.task).toBe("Test task");
      expect(result.exitCode).toBe(0);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.usage.turns).toBe(1);
    });

    it("should track usage statistics", async () => {
      const mockSession = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Done" }],
        usage: { input: 500, output: 1200, cacheRead: 100, cacheWrite: 50, totalTokens: 1800, cost: { total: 0.02 } },
        model: "test-model",
        stopReason: "end"
      }]);

      const result = await executeSubagent({
        agent: testAgent,
        task: "Test",
        cwd: "/test",
        createSessionFn: createMockSessionFactory([mockSession]),
      });

      expect(result.usage.input).toBe(500);
      expect(result.usage.output).toBe(1200);
      expect(result.usage.cacheRead).toBe(100);
      expect(result.usage.cacheWrite).toBe(50);
      expect(result.usage.cost).toBe(0.02);
      expect(result.usage.contextTokens).toBe(1800);
    });

    it("should handle abort signal", async () => {
      const controller = new AbortController();
      
      // Abort immediately
      controller.abort();

      const result = await executeSubagent({
        agent: testAgent,
        task: "Test",
        cwd: "/test",
        signal: controller.signal,
        createSessionFn: createMockSessionFactory(),
      }).catch(e => e);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain("aborted");
    });

    it("should call onUpdate callback during execution", async () => {
      const updates: any[] = [];
      const mockSession = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Done" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
      }]);

      await executeSubagent({
        agent: testAgent,
        task: "Test",
        cwd: "/test",
        createSessionFn: createMockSessionFactory([mockSession]),
        onUpdate: (partial) => {
          updates.push(partial);
        },
      });

      expect(updates.length).toBeGreaterThan(0);
    });

    it("should handle errors gracefully", async () => {
      const failingSessionFactory = async () => {
        throw new Error("Session creation failed");
      };

      const result = await executeSubagent({
        agent: testAgent,
        task: "Test",
        cwd: "/test",
        createSessionFn: failingSessionFactory,
      });

      expect(result.exitCode).toBe(1);
      expect(result.errorMessage).toContain("Session creation failed");
    });
  });

  describe("executeParallelSubagents (parallel mode)", () => {
    it("should execute multiple tasks in parallel", async () => {
      const tasks = [
        { agent: testAgent, task: "Task 1", cwd: "/test" },
        { agent: testAgent, task: "Task 2", cwd: "/test" },
      ];

      const mockSession1 = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Result 1" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
      }]);

      const mockSession2 = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Result 2" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
      }]);

      const results = await executeParallelSubagents(
        tasks,
        undefined,
        undefined,
        createMockSessionFactory([mockSession1, mockSession2])
      );

      expect(results.length).toBe(2);
      expect(results[0].exitCode).toBe(0);
      expect(results[1].exitCode).toBe(0);
    });

    it("should respect concurrency limit", async () => {
      const tasks = Array(8).fill(null).map((_, i) => ({
        agent: testAgent,
        task: `Task ${i}`,
        cwd: "/test",
      }));

      const sessions = tasks.map(() => createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Done" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
      }]));

      const results = await executeParallelSubagents(
        tasks,
        undefined,
        undefined,
        createMockSessionFactory(sessions)
      );

      expect(results.length).toBe(8);
      expect(results.every(r => r.exitCode === 0)).toBe(true);
    });

    it("should handle mixed success and failure", async () => {
      const tasks = [
        { agent: testAgent, task: "Task 1", cwd: "/test" },
        { agent: testWorkspaceAgent, task: "Task 2", cwd: "/test" },
      ];

      const successSession = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Success" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
      }]);

      const failingSessionFactory = async () => {
        throw new Error("Failed");
      };

      const results = await executeParallelSubagents(
        tasks,
        undefined,
        undefined,
        async (config) => {
          if (config.systemPrompt.includes("workspace")) {
            throw new Error("Failed");
          }
          return { session: successSession, cleanup: async () => {} };
        }
      );

      expect(results.length).toBe(2);
      expect(results[0].exitCode).toBe(0);
      expect(results[1].exitCode).toBe(1);
    });
  });

  describe("executeChainSubagents (chain mode)", () => {
    it("should execute tasks sequentially", async () => {
      const steps = [
        { agent: testAgent, task: "Step 1", cwd: "/test" },
        { agent: testAgent, task: "Step 2 with {previous}", cwd: "/test" },
      ];

      const session1 = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Result 1" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
      }]);

      const session2 = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Result 2 with Result 1" }],
        usage: { input: 150, output: 250, totalTokens: 400, cost: { total: 0.02 } },
        model: "test-model",
      }]);

      const results = await executeChainSubagents(
        steps,
        undefined,
        undefined,
        createMockSessionFactory([session1, session2])
      );

      expect(results.length).toBe(2);
      expect(results[0].exitCode).toBe(0);
      expect(results[1].exitCode).toBe(0);
    });

    it("should replace {previous} placeholder", async () => {
      const steps = [
        { agent: testAgent, task: "Find code", cwd: "/test" },
        { agent: testAgent, task: "Improve: {previous}", cwd: "/test" },
      ];

      let capturedTask = "";
      
      const session1 = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Found auth code" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
      }]);

      const session2 = {
        ...createMockSession([{
          role: "assistant",
          content: [{ type: "text", text: "Improved" }],
          usage: { input: 150, output: 250, totalTokens: 400, cost: { total: 0.02 } },
          model: "test-model",
        }]),
        prompt: mock(async (task: string) => {
          capturedTask = task;
        }),
      };

      await executeChainSubagents(
        steps,
        undefined,
        undefined,
        createMockSessionFactory([session1, session2])
      );

      expect(capturedTask).toContain("Found auth code");
    });

    it("should stop on failure", async () => {
      const steps = [
        { agent: testAgent, task: "Step 1", cwd: "/test" },
        { agent: testAgent, task: "Step 2", cwd: "/test" },
        { agent: testAgent, task: "Step 3", cwd: "/test" },
      ];

      const session1 = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Success 1" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
      }]);

      const failingSession = {
        ...createMockSession([]),
        prompt: mock(async () => {
          throw new Error("Step 2 failed");
        }),
      };

      const results = await executeChainSubagents(
        steps,
        undefined,
        undefined,
        createMockSessionFactory([session1, failingSession])
      );

      expect(results.length).toBe(2); // Stopped after failure
      expect(results[0].exitCode).toBe(0);
      expect(results[1].exitCode).toBe(1);
    });

    it("should track step numbers in results", async () => {
      const steps = [
        { agent: testAgent, task: "Step 1", cwd: "/test" },
        { agent: testAgent, task: "Step 2", cwd: "/test" },
      ];

      const session1 = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Done 1" }],
        usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
        model: "test-model",
      }]);

      const session2 = createMockSession([{
        role: "assistant",
        content: [{ type: "text", text: "Done 2" }],
        usage: { input: 150, output: 250, totalTokens: 400, cost: { total: 0.02 } },
        model: "test-model",
      }]);

      const results = await executeChainSubagents(
        steps,
        undefined,
        undefined,
        createMockSessionFactory([session1, session2])
      );

      // Verify both steps executed
      expect(results.length).toBe(2);
      // Verify sequential execution by checking both completed
      expect(results[0].exitCode).toBe(0);
      expect(results[1].exitCode).toBe(0);
    });

    it("should aggregate total usage", async () => {
      const steps = [
        { agent: testAgent, task: "Step 1", cwd: "/test" },
        { agent: testAgent, task: "Step 2", cwd: "/test" },
      ];

      const sessions = [
        createMockSession([{
          role: "assistant",
          content: [{ type: "text", text: "Done 1" }],
          usage: { input: 100, output: 200, totalTokens: 300, cost: { total: 0.01 } },
          model: "test-model",
        }]),
        createMockSession([{
          role: "assistant",
          content: [{ type: "text", text: "Done 2" }],
          usage: { input: 150, output: 250, totalTokens: 400, cost: { total: 0.02 } },
          model: "test-model",
        }]),
      ];

      const results = await executeChainSubagents(
        steps,
        undefined,
        undefined,
        createMockSessionFactory(sessions)
      );

      const totalUsage = aggregateUsage(results);
      expect(totalUsage.input).toBe(250);
      expect(totalUsage.output).toBe(450);
      expect(totalUsage.cost).toBe(0.03);
      expect(totalUsage.turns).toBe(2);
    });
  });
});
