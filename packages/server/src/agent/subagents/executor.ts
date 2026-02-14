/**
 * Subagent execution engine
 *
 * Executes subagent tasks in isolated sessions with custom configurations.
 */

import type { AgentSession, AgentSessionEvent, SessionStats } from "@mariozechner/pi-coding-agent";
import type { AssistantMessage, Message } from "@mariozechner/pi-ai";
import type { SubagentConfig, SingleResult, UsageStats } from "./types.js";

// ─── Execution Options ────────────────────────────────────────────────────

export interface SubagentExecutionOptions {
  /** Subagent configuration */
  agent: SubagentConfig;
  /** Task to execute */
  task: string;
  /** Working directory */
  cwd: string;
  /** Abort signal */
  signal?: AbortSignal;
  /** Progress update callback */
  onUpdate?: (partial: Partial<SingleResult>) => void;
  /** Agent session creator function */
  createSessionFn: (config: SubagentSessionConfig) => Promise<SubagentSession>;
}

export interface SubagentSessionConfig {
  cwd: string;
  systemPrompt: string;
  tools?: string[];
  model?: string;
  metadata?: {
    subagentDepth?: number;
    subagentChain?: string[];
  };
}

export interface SubagentSession {
  session: AgentSession;
  cleanup: () => Promise<void>;
}

// ─── Utility Functions ────────────────────────────────────────────────────

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsageStats(
  usage: UsageStats,
  model?: string,
): string {
  const parts: string[] = [];
  if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
  if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
  if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
  if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
  if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
  if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
  if (usage.contextTokens && usage.contextTokens > 0) {
    parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
  }
  if (model) parts.push(model);
  return parts.join(" ");
}

function isAssistantMessage(msg: Message): msg is AssistantMessage {
  return msg.role === "assistant";
}

// ─── Main Execution Function ──────────────────────────────────────────────

/**
 * Execute a single subagent task
 */
export async function executeSubagent(
  options: SubagentExecutionOptions
): Promise<SingleResult> {
  const { agent, task, cwd, signal, onUpdate, createSessionFn } = options;

  const result: SingleResult = {
    agent: agent.name,
    agentSource: agent.source,
    task,
    exitCode: 0,
    messages: [],
    stderr: "",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      contextTokens: 0,
      turns: 0,
    },
    model: agent.model,
  };

  // Helper to emit progress updates
  const emitUpdate = () => {
    if (onUpdate) {
      onUpdate({ ...result });
    }
  };

  let subagentSession: SubagentSession | null = null;

  try {
    // Create isolated session for subagent
    subagentSession = await createSessionFn({
      cwd,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools,
      model: agent.model,
    });

    const { session, cleanup } = subagentSession;

    // Track messages and usage
    let aborted = false;

    // Set up event listener for streaming
    const eventHandler = (event: AgentSessionEvent) => {
      if (event.type === "message_end" && event.message) {
        result.messages.push(event.message);

        if (isAssistantMessage(event.message)) {
          result.usage.turns++;
          const usage = event.message.usage;
          if (usage) {
            result.usage.input += usage.input || 0;
            result.usage.output += usage.output || 0;
            result.usage.cacheRead += usage.cacheRead || 0;
            result.usage.cacheWrite += usage.cacheWrite || 0;
            result.usage.cost += usage.cost?.total || 0;
            result.usage.contextTokens = usage.totalTokens || 0;
          }
          if (!result.model && event.message.model) {
            result.model = event.message.model;
          }
          if (event.message.stopReason) {
            result.stopReason = event.message.stopReason;
          }
          if (event.message.errorMessage) {
            result.errorMessage = event.message.errorMessage;
          }
        }

        emitUpdate();
      }

      if (event.type === "tool_result_end" && event.message) {
        result.messages.push(event.message);
        emitUpdate();
      }
    };

    const unsubscribe = session.subscribe(eventHandler);

    // Handle abort signal
    if (signal) {
      const abortHandler = () => {
        aborted = true;
        session.abort();
      };

      if (signal.aborted) {
        abortHandler();
      } else {
        signal.addEventListener("abort", abortHandler, { once: true });
      }
    }

    // Execute the task
    try {
      await session.prompt(task);

      if (aborted) {
        result.exitCode = 1;
        result.errorMessage = "Subagent execution was aborted";
      }
    } catch (error) {
      result.exitCode = 1;
      result.errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SubagentExecutor] Error executing ${agent.name}:`, error);
    }

    // Cleanup event listener
    session.off("event", eventHandler);

    // Clean up the session
    await cleanup();

    if (aborted) {
      throw new Error("Subagent was aborted");
    }

    return result;
  } catch (error) {
    // Unsubscribe from events
    if (unsubscribe) {
      unsubscribe();
    }

    // Ensure cleanup happens even on error
    if (subagentSession) {
      try {
        await subagentSession.cleanup();
      } catch (cleanupError) {
        console.error(`[SubagentExecutor] Cleanup error:`, cleanupError);
      }
    }

    if (error instanceof Error && error.message === "Subagent was aborted") {
      throw error;
    }

    result.exitCode = 1;
    result.errorMessage = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    // Unsubscribe from events
    if (unsubscribe) {
      unsubscribe();
    }
  }
}

// ─── Parallel Execution ────────────────────────────────────────────────────

const MAX_CONCURRENCY = 4;

/**
 * Execute multiple subagent tasks in parallel with concurrency limit
 */
export async function executeParallelSubagents(
  tasks: Array<{
    agent: SubagentConfig;
    task: string;
    cwd: string;
  }>,
  signal: AbortSignal | undefined,
  onUpdate: ((partial: Partial<SingleResult>) => void) | undefined,
  createSessionFn: SubagentExecutionOptions["createSessionFn"]
): Promise<SingleResult[]> {
  if (tasks.length === 0) return [];

  const results: SingleResult[] = new Array(tasks.length);
  let nextIndex = 0;

  // Worker function that processes tasks from the queue
  const worker = async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= tasks.length) return;

      const { agent, task, cwd } = tasks[current];

      // Create update callback for this task
      const taskUpdate = onUpdate
        ? (partial: Partial<SingleResult>) => {
            // Merge with previous results for parallel display
            const allResults = [...results];
            if (partial) {
              allResults[current] = {
                ...allResults[current],
                agent: agent.name,
                agentSource: agent.source,
                task,
                exitCode: partial.exitCode ?? 0,
                messages: partial.messages ?? [],
                stderr: partial.stderr ?? "",
                usage: partial.usage ?? {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                  cost: 0,
                  contextTokens: 0,
                  turns: 0,
                },
                model: partial.model ?? agent.model,
                step: current,
              } as SingleResult;
              onUpdate(allResults[current]);
            }
          }
        : undefined;

      results[current] = await executeSubagent({
        agent,
        task,
        cwd,
        signal,
        onUpdate: taskUpdate,
        createSessionFn,
      });
    }
  };

  // Create workers up to concurrency limit
  const limit = Math.max(1, Math.min(MAX_CONCURRENCY, tasks.length));
  const workers = new Array(limit).fill(null).map(() => worker());

  await Promise.all(workers);

  return results;
}

// ─── Chain Execution ──────────────────────────────────────────────────────

/**
 * Execute subagent tasks sequentially, passing output between steps
 */
export async function executeChainSubagents(
  steps: Array<{
    agent: SubagentConfig;
    task: string;
    cwd: string;
  }>,
  signal: AbortSignal | undefined,
  onUpdate: ((partial: Partial<SingleResult>) => void) | undefined,
  createSessionFn: SubagentExecutionOptions["createSessionFn"]
): Promise<SingleResult[]> {
  const results: SingleResult[] = [];
  let previousOutput = "";

  for (let i = 0; i < steps.length; i++) {
    const { agent, task, cwd } = steps[i];

    // Replace {previous} placeholder with prior output
    const taskWithContext = task.replace(/\{previous\}/g, previousOutput);

    // Create update callback that includes all previous results
    const chainUpdate = onUpdate
      ? (partial: Partial<SingleResult>) => {
          if (partial) {
            const currentResult: SingleResult = {
              agent: agent.name,
              agentSource: agent.source,
              task,
              exitCode: partial.exitCode ?? 0,
              messages: partial.messages ?? [],
              stderr: partial.stderr ?? "",
              usage: partial.usage ?? {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                cost: 0,
                contextTokens: 0,
                turns: 0,
              },
              model: partial.model ?? agent.model,
              step: i,
            };

            // Combine completed results with current streaming result
            const allResults = [...results, currentResult];
            onUpdate(currentResult);
          }
        }
      : undefined;

    const result = await executeSubagent({
      agent,
      task: taskWithContext,
      cwd,
      signal,
      onUpdate: chainUpdate,
      createSessionFn,
    });

    results.push(result);

    // If a step fails, stop the chain
    if (result.exitCode !== 0) {
      console.error(
        `[SubagentExecutor] Chain failed at step ${i + 1} (${agent.name}): ${result.errorMessage}`
      );
      break;
    }

    // Extract output for next step
    previousOutput = getFinalOutput(result.messages);
  }

  return results;
}

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Extract the final text output from messages
 */
export function getFinalOutput(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text") return part.text;
      }
    }
  }
  return "";
}

/**
 * Aggregate usage stats from multiple results
 */
export function aggregateUsage(results: SingleResult[]): UsageStats {
  const aggregated: UsageStats = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    contextTokens: 0,
    turns: 0,
  };

  for (const result of results) {
    aggregated.input += result.usage.input;
    aggregated.output += result.usage.output;
    aggregated.cacheRead += result.usage.cacheRead;
    aggregated.cacheWrite += result.usage.cacheWrite;
    aggregated.cost += result.usage.cost;
    aggregated.turns += result.usage.turns;
    aggregated.contextTokens = Math.max(aggregated.contextTokens, result.usage.contextTokens);
  }

  return aggregated;
}
