/**
 * Subagent Tool
 *
 * Delegates tasks to specialized subagents with isolated context windows.
 * Supports three modes: single, parallel, and chain execution.
 */

import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ToolDefinition, AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-agent-core";
import type { IAgentManager } from "./custom-provider-add.js";
import {
  discoverSubagents,
  executeSubagent,
  executeParallelSubagents,
  executeChainSubagents,
  getFinalOutput,
  aggregateUsage,
  type AgentScope,
  type TaskItem,
  type ChainItem,
  type SingleResult,
  type SubagentSessionConfig,
} from "../subagents/index.js";

// ─── Parameters Schema ────────────────────────────────────────────────────

const TaskItemSchema = Type.Object({
  agent: Type.String({ description: "Name of the agent to invoke" }),
  task: Type.String({ description: "Task to delegate to the agent" }),
  cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const ChainItemSchema = Type.Object({
  agent: Type.String({ description: "Name of the agent to invoke" }),
  task: Type.String({
    description: "Task with optional {previous} placeholder for prior output",
  }),
  cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const AgentScopeSchema = StringEnum(["user", "workspace", "both"] as const, {
  description: 'Which agent directories to use. Default: "user". Use "both" to include workspace-level agents.',
  default: "user",
});

const SubagentParams = Type.Object({
  agent: Type.Optional(
    Type.String({ description: "Name of the agent to invoke (for single mode)" })
  ),
  task: Type.Optional(
    Type.String({ description: "Task to delegate (for single mode)" })
  ),
  tasks: Type.Optional(
    Type.Array(TaskItemSchema, { description: "Array of {agent, task} for parallel execution" })
  ),
  chain: Type.Optional(
    Type.Array(ChainItemSchema, { description: "Array of {agent, task} for sequential execution" })
  ),
  agentScope: Type.Optional(AgentScopeSchema),
  confirmWorkspaceAgents: Type.Optional(
    Type.Boolean({
      description: "Prompt before running workspace-level agents. Default: true.",
      default: true,
    })
  ),
  cwd: Type.Optional(
    Type.String({ description: "Working directory for the agent process (single mode)" })
  ),
});

// ─── Tool Result Details ──────────────────────────────────────────────────

interface SubagentDetails {
  mode: "single" | "parallel" | "chain";
  agentScope: AgentScope;
  workspaceAgentsDir: string | null;
  results: SingleResult[];
}

// ─── Tool Factory ──────────────────────────────────────────────────────────

export function createSubagentTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "subagent",
    label: "Subagent",
    description: [
      "Delegate tasks to specialized subagents with isolated context.",
      "Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder).",
      'Default agent scope is "user" (from ~/.config/friend/subagents).',
      'To enable workspace-level agents in {workspace}/subagents, set agentScope: "both" (or "workspace").',
    ].join(" "),
    parameters: SubagentParams,

    async execute(
      toolCallId: string,
      params: any,
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      ctx: any
    ): Promise<AgentToolResult<SubagentDetails>> {
      const agentScope: AgentScope = params.agentScope ?? "user";

      // Get workspace path from context
      const workspacePath = ctx.workspacePath as string | undefined;

      // Discover available subagents
      const discovery = discoverSubagents(workspacePath, agentScope);
      const agents = discovery.agents;
      const confirmWorkspaceAgents = params.confirmWorkspaceAgents ?? true;

      // Determine mode
      const hasChain = (params.chain?.length ?? 0) > 0;
      const hasTasks = (params.tasks?.length ?? 0) > 0;
      const hasSingle = Boolean(params.agent && params.task);
      const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

      // Helper to create details object
      const makeDetails =
        (mode: "single" | "parallel" | "chain") =>
        (results: SingleResult[]): SubagentDetails => ({
          mode,
          agentScope,
          workspaceAgentsDir: discovery.workspaceAgentsDir,
          results,
        });

      // Validate mode
      if (modeCount !== 1) {
        const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
        return {
          content: [
            {
              type: "text",
              text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
            },
          ],
          details: makeDetails("single")([]),
        };
      }

      // Security check for workspace agents
      if (
        (agentScope === "workspace" || agentScope === "both") &&
        confirmWorkspaceAgents &&
        ctx.hasUI
      ) {
        const requestedAgentNames = new Set<string>();
        if (params.chain)
          for (const step of params.chain) requestedAgentNames.add(step.agent);
        if (params.tasks) for (const t of params.tasks) requestedAgentNames.add(t.agent);
        if (params.agent) requestedAgentNames.add(params.agent);

        const workspaceAgentsRequested = Array.from(requestedAgentNames)
          .map((name) => agents.find((a) => a.name === name))
          .filter((a): a is NonNullable<typeof a> => a?.source === "workspace");

        if (workspaceAgentsRequested.length > 0) {
          const names = workspaceAgentsRequested.map((a) => a.name).join(", ");
          const dir = discovery.workspaceAgentsDir ?? "(unknown)";
          const ok = await ctx.ui.confirm(
            "Run workspace-level agents?",
            `Agents: ${names}\nSource: ${dir}\n\nWorkspace agents are directory-controlled. Only continue for trusted locations.`
          );
          if (!ok) {
            return {
              content: [{ type: "text", text: "Canceled: workspace-level agents not approved." }],
              details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
            };
          }
        }
      }

      // Create session factory function
      const createSessionFn = async (config: SubagentSessionConfig) => {
        if (!manager.createSubagentSession) {
          throw new Error("AgentManager does not support subagent sessions");
        }
        return manager.createSubagentSession(config);
      };

      // Execute based on mode
      try {
        if (hasChain && params.chain) {
          // Chain mode
          const steps = params.chain.map((item: ChainItem) => {
            const agent = agents.find((a) => a.name === item.agent);
            if (!agent) {
              throw new Error(
                `Unknown agent: "${item.agent}". Available: ${agents.map((a) => a.name).join(", ")}`
              );
            }
            return {
              agent,
              task: item.task,
              cwd: item.cwd ?? ctx.cwd,
            };
          });

          const results = await executeChainSubagents(
            steps,
            signal,
            onUpdate
              ? (partial) => {
                  onUpdate({
                    content: [{ type: "text", text: "(executing chain...)" }],
                    details: makeDetails("chain")(
                      partial.step !== undefined ? [partial as SingleResult] : []
                    ),
                  });
                }
              : undefined,
            createSessionFn
          );

          const output = results
            .map((r, i) => {
              const status = r.exitCode === 0 ? "✓" : "✗";
              return `Step ${i + 1} (${status}): ${r.agent}\n${getFinalOutput(r.messages)}`;
            })
            .join("\n\n---\n\n");

          const totalUsage = aggregateUsage(results);

          return {
            content: [{ type: "text", text: output }],
            details: makeDetails("chain")(results),
          };
        } else if (hasTasks && params.tasks) {
          // Parallel mode
          const tasks = params.tasks.map((item: TaskItem) => {
            const agent = agents.find((a) => a.name === item.agent);
            if (!agent) {
              throw new Error(
                `Unknown agent: "${item.agent}". Available: ${agents.map((a) => a.name).join(", ")}`
              );
            }
            return {
              agent,
              task: item.task,
              cwd: item.cwd ?? ctx.cwd,
            };
          });

          const results = await executeParallelSubagents(
            tasks,
            signal,
            onUpdate
              ? (partial) => {
                  onUpdate({
                    content: [{ type: "text", text: "(executing in parallel...)" }],
                    details: makeDetails("parallel")(
                      partial.step !== undefined ? [partial as SingleResult] : []
                    ),
                  });
                }
              : undefined,
            createSessionFn
          );

          const output = results
            .map((r) => {
              const status = r.exitCode === 0 ? "✓" : "✗";
              return `${status} ${r.agent}: ${getFinalOutput(r.messages)}`;
            })
            .join("\n\n");

          return {
            content: [{ type: "text", text: output }],
            details: makeDetails("parallel")(results),
          };
        } else if (hasSingle && params.agent && params.task) {
          // Single mode
          const agent = agents.find((a) => a.name === params.agent);
          if (!agent) {
            const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
            return {
              content: [
                {
                  type: "text",
                  text: `Unknown agent: "${params.agent}". Available agents: ${available}.`,
                },
              ],
              details: makeDetails("single")([]),
            };
          }

          const result = await executeSubagent({
            agent,
            task: params.task,
            cwd: params.cwd ?? ctx.cwd,
            signal,
            onUpdate: onUpdate
              ? (partial) => {
                  onUpdate({
                    content: [{ type: "text", text: "(executing...)" }],
                    details: makeDetails("single")([partial as SingleResult]),
                  });
                }
              : undefined,
            createSessionFn,
          });

          const output = getFinalOutput(result.messages);

          return {
            content: [{ type: "text", text: output }],
            details: makeDetails("single")([result]),
          };
        } else {
          return {
            content: [{ type: "text", text: "Invalid parameters" }],
            details: makeDetails("single")([]),
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${errorMessage}` }],
          details: makeDetails("single")([]),
        };
      }
    },
  };
}
