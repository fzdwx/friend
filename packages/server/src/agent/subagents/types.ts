/**
 * Subagent types
 * 
 * Subagents are specialized agents with isolated context windows
 * that can be delegated specific tasks.
 */

/**
 * Agent scope for discovery
 */
export type AgentScope = "user" | "workspace" | "both";

/**
 * Subagent configuration loaded from markdown files
 */
export interface SubagentConfig {
  /** Unique name of the subagent */
  name: string;
  /** Human-readable description */
  description: string;
  /** Allowed tools (optional, defaults to all tools) */
  tools?: string[];
  /** Model to use (optional, defaults to session model) */
  model?: string;
  /** System prompt from the markdown body */
  systemPrompt: string;
  /** Where this subagent was loaded from */
  source: "user" | "workspace";
  /** File path for debugging */
  filePath: string;
}

/**
 * Result of subagent discovery
 */
export interface SubagentDiscoveryResult {
  /** Discovered subagents */
  agents: SubagentConfig[];
  /** Path to workspace agents directory (if exists) */
  workspaceAgentsDir: string | null;
}

/**
 * Usage statistics for a subagent execution
 */
export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

/**
 * Result of a single subagent execution
 */
export interface SingleResult {
  /** Agent name */
  agent: string;
  /** Agent source */
  agentSource: "user" | "workspace" | "unknown";
  /** Task that was executed */
  task: string;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Messages from the subagent */
  messages: any[];
  /** Standard error output */
  stderr: string;
  /** Usage statistics */
  usage: UsageStats;
  /** Model used */
  model?: string;
  /** Stop reason from LLM */
  stopReason?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Step number in chain mode */
  step?: number;
}

/**
 * Task item for parallel execution
 */
export interface TaskItem {
  agent: string;
  task: string;
  cwd?: string;
}

/**
 * Chain item for sequential execution
 */
export interface ChainItem {
  agent: string;
  task: string;
  cwd?: string;
}
