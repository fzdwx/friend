/**
 * Subagent discovery and configuration
 * 
 * Discovers subagent definitions from markdown files with YAML frontmatter.
 * Supports user-level (~/.config/friend/subagents/) and workspace-level ({workspace}/subagents/) agents.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";
import type { SubagentConfig, SubagentDiscoveryResult, AgentScope } from "./types.js";

/**
 * Get the user-level subagents directory
 */
export function getUserSubagentsDir(): string {
  return path.join(homedir(), ".config", "friend", "subagents");
}

/**
 * Find workspace-level subagents directory
 * Returns the subagents directory within the given workspace path
 */
export function findWorkspaceSubagentsDir(workspacePath: string | undefined): string | null {
  if (!workspacePath) return null;
  
  const subagentsDir = path.join(workspacePath, "subagents");
  
  if (isDirectory(subagentsDir)) {
    return subagentsDir;
  }
  
  return null;
}

/**
 * Load subagent definitions from a directory
 */
function loadSubagentsFromDir(
  dir: string, 
  source: "user" | "workspace"
): SubagentConfig[] {
  const agents: SubagentConfig[] = [];

  if (!fs.existsSync(dir)) {
    return agents;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    console.error(`[SubagentDiscovery] Failed to read directory ${dir}:`, error);
    return agents;
  }

  for (const entry of entries) {
    // Only process .md files
    if (!entry.name.endsWith(".md")) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.error(`[SubagentDiscovery] Failed to read file ${filePath}:`, error);
      continue;
    }

    try {
      const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);

      // Validate required fields
      if (!frontmatter.name || !frontmatter.description) {
        console.warn(
          `[SubagentDiscovery] Skipping ${filePath}: missing required frontmatter fields (name, description)`
        );
        continue;
      }

      // Parse tools list (comma-separated)
      const tools = frontmatter.tools
        ?.split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);

      agents.push({
        name: frontmatter.name,
        description: frontmatter.description,
        tools: tools && tools.length > 0 ? tools : undefined,
        model: frontmatter.model,
        systemPrompt: body.trim(),
        source,
        filePath,
      });
    } catch (error) {
      console.error(`[SubagentDiscovery] Failed to parse ${filePath}:`, error);
    }
  }

  return agents;
}

/**
 * Check if a path is a directory
 */
function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Cache for discovered subagents
 */
interface DiscoveryCache {
  userAgents: SubagentConfig[];
  userMtime: number;
  workspaceAgents: Map<string, { agents: SubagentConfig[]; mtime: number }>;
}

const cache: DiscoveryCache = {
  userAgents: [],
  userMtime: 0,
  workspaceAgents: new Map(),
};

/**
 * Get directory modification time for cache invalidation
 */
function getDirectoryMtime(dir: string): number {
  try {
    if (!fs.existsSync(dir)) return 0;
    
    const stat = fs.statSync(dir);
    let maxMtime = stat.mtimeMs;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.endsWith(".md")) {
        const filePath = path.join(dir, entry.name);
        try {
          const fileStat = fs.statSync(filePath);
          maxMtime = Math.max(maxMtime, fileStat.mtimeMs);
        } catch {}
      }
    }
    
    return maxMtime;
  } catch {
    return 0;
  }
}

/**
 * Discover subagent definitions from user and/or workspace directories
 * 
 * @param workspacePath - Workspace directory path (for finding workspace-level agents)
 * @param scope - Which agent directories to search: "user", "workspace", or "both"
 * @returns Discovery result with agents and workspace directory path
 */
export function discoverSubagents(
  workspacePath: string | undefined, 
  scope: AgentScope = "user"
): SubagentDiscoveryResult {
  const userDir = getUserSubagentsDir();
  const workspaceAgentsDir = findWorkspaceSubagentsDir(workspacePath);

  // Load user-level agents (if requested)
  let userAgents: SubagentConfig[] = [];
  if (scope !== "workspace") {
    const userMtime = getDirectoryMtime(userDir);
    
    // Use cache if valid
    if (cache.userMtime > 0 && cache.userMtime === userMtime) {
      userAgents = cache.userAgents;
    } else {
      userAgents = loadSubagentsFromDir(userDir, "user");
      cache.userAgents = userAgents;
      cache.userMtime = userMtime;
    }
  }

  // Load workspace-level agents (if requested)
  let workspaceAgents: SubagentConfig[] = [];
  if (scope !== "user" && workspaceAgentsDir) {
    const cached = cache.workspaceAgents.get(workspaceAgentsDir);
    const workspaceMtime = getDirectoryMtime(workspaceAgentsDir);
    
    // Use cache if valid
    if (cached && cached.mtime === workspaceMtime) {
      workspaceAgents = cached.agents;
    } else {
      workspaceAgents = loadSubagentsFromDir(workspaceAgentsDir, "workspace");
      cache.workspaceAgents.set(workspaceAgentsDir, { 
        agents: workspaceAgents, 
        mtime: workspaceMtime 
      });
    }
  }

  // Merge agents with workspace taking precedence
  const agentMap = new Map<string, SubagentConfig>();

  if (scope === "both") {
    // Add user agents first
    for (const agent of userAgents) {
      agentMap.set(agent.name, agent);
    }
    // Then workspace agents (overwrites user agents with same name)
    for (const agent of workspaceAgents) {
      agentMap.set(agent.name, agent);
    }
  } else if (scope === "user") {
    for (const agent of userAgents) {
      agentMap.set(agent.name, agent);
    }
  } else {
    // scope === "workspace"
    for (const agent of workspaceAgents) {
      agentMap.set(agent.name, agent);
    }
  }

  return {
    agents: Array.from(agentMap.values()),
    workspaceAgentsDir,
  };
}

/**
 * Format a list of subagents for display
 */
export function formatSubagentList(
  agents: SubagentConfig[], 
  maxItems: number = 10
): { text: string; remaining: number } {
  if (agents.length === 0) {
    return { text: "No subagents available", remaining: 0 };
  }

  const listed = agents.slice(0, maxItems);
  const remaining = agents.length - listed.length;

  const text = listed
    .map((a) => `${a.name} (${a.source}): ${a.description}`)
    .join("; ");

  return { text, remaining };
}

/**
 * Clear the discovery cache (useful for testing or force refresh)
 */
export function clearCache(): void {
  cache.userAgents = [];
  cache.userMtime = 0;
  cache.workspaceAgents.clear();
}
