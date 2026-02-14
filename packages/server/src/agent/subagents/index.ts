/**
 * Subagents module
 * 
 * Specialized agents with isolated context windows for task delegation.
 */

export * from "./types.js";
export {
  discoverSubagents,
  getUserSubagentsDir,
  findWorkspaceSubagentsDir,
  formatSubagentList,
  clearCache,
} from "./discovery.js";
export {
  executeSubagent,
  executeParallelSubagents,
  executeChainSubagents,
  getFinalOutput,
  aggregateUsage,
  type SubagentExecutionOptions,
  type SubagentSessionConfig,
  type SubagentSession,
} from "./executor.js";
