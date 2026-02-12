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
  /** Source identifier (e.g., "user", "project") */
  source: string;
  /** Whether the skill is disabled from model invocation */
  disableModelInvocation: boolean;
}

/**
 * Project skill path information.
 */
export interface ProjectSkillPath {
  /** Path to the project skills directory */
  path: string;
  /** Session ID that uses this path */
  sessionId: string;
  /** Session name for display */
  sessionName: string;
}

/**
 * Skill paths information.
 */
export interface SkillPaths {
  /** Global skills directory path */
  global: string;
  /** Project-specific skill paths from all sessions */
  projects: ProjectSkillPath[];
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
