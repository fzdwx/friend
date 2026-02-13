/**
 * Skill information returned by the API.
 * Based on pi-coding-agent's Skill type.
 */
export interface SkillInfo {
  /** Skill name (matches directory name or filename without extension) */
  name: string;
  /** Description of what the skill does */
  description: string;
  /** Absolute path to the skill file */
  filePath: string;
  /** Base directory containing the skill */
  baseDir: string;
  /** Source identifier (e.g., "user", "agent") */
  source: string;
  /** Whether the skill is disabled from model invocation */
  disableModelInvocation: boolean;
}

/**
 * Agent skill path information.
 */
export interface AgentSkillPath {
  /** Agent ID */
  agentId: string;
  /** Path to the agent skills directory */
  path: string;
}

/**
 * Skill paths information.
 */
export interface SkillPaths {
  /** Global skills directory path */
  global: string;
  /** Agent-specific skill paths */
  agents: AgentSkillPath[];
}

/**
 * Response for GET /api/skills
 */
export interface SkillsResponse {
  ok: boolean;
  data: SkillInfo[];
}

/**
 * Response for GET /api/skills/paths
 */
export interface SkillPathsResponse {
  ok: boolean;
  data: SkillPaths;
}
