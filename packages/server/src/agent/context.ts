import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentIdentity } from "@friend/shared";

// Only load files that define how the agent works, not content it should read itself
const WORKSPACE_FILES = ["AGENTS.md"] as const;

export type WorkspaceFile = { path: string; content: string };

/**
 * Load workspace files from a directory
 * Note: We only load AGENTS.md here. Other files (SOUL.md, IDENTITY.md, USER.md, etc.)
 * are read by the LLM itself as directed by AGENTS.md instructions.
 */
export async function loadWorkspaceFiles(workspaceDir: string): Promise<WorkspaceFile[]> {
  const results: WorkspaceFile[] = [];

  for (const name of WORKSPACE_FILES) {
    try {
      const path = join(workspaceDir, name);
      const content = await readFile(path, "utf-8");
      if (content.trim()) {
        results.push({ path, content });
      }
    } catch {
      // File doesn't exist or not readable, skip
    }
  }

  return results;
}

/**
 * Load bootstrap files from agent workspace
 *
 * @param agentWorkspaceDir - Agent's workspace directory
 */
export async function loadAgentBootstrapFiles(
  agentWorkspaceDir: string
): Promise<WorkspaceFile[]> {
  return loadWorkspaceFiles(agentWorkspaceDir);
}

/**
 * Build context message for injection
 *
 * We inject:
 * - Workspace paths (working directory + personal workspace)
 * - AGENTS.md (if exists) - defines how the agent works
 *
 * The LLM will read other files (SOUL.md, IDENTITY.md, USER.md, etc.) itself
 * as directed by AGENTS.md instructions. This ensures:
 * 1. LLM always gets the latest file content
 * 2. No duplicate/stale content in session history
 * 3. Reduced token usage
 *
 * @param cwd - Working directory (project path)
 * @param files - Workspace files (AGENTS.md)
 * @param identity - Agent identity for name
 * @param workspaceDir - Workspace directory path
 */
export function buildWorkspacePrompt(
  cwd: string,
  files: WorkspaceFile[],
  identity?: AgentIdentity,
  workspaceDir?: string
): string {
  const displayName = identity?.name || "Friend";

  const lines: string[] = [
    "## Workspace",
    `- Working directory: ${cwd}`,
    `- Personal workspace: ${workspaceDir || cwd}`,
    "",
    "The **working directory** is where you operate on project files.",
    "The **personal workspace** is where you store memories, notes, and agent-specific files.",
    "",
  ];

  // Include AGENTS.md if present
  const agentsFile = files.find((f) => f.path.endsWith("AGENTS.md"));
  if (agentsFile) {
    lines.push("---", "", agentsFile.content, "");
  }

  return lines.join("\n");
}
