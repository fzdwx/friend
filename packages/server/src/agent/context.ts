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

  // Get today's date for {today} variable
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  for (const name of WORKSPACE_FILES) {
    try {
      const path = join(workspaceDir, name);
      let content = await readFile(path, "utf-8");
      if (content.trim()) {
        // Replace variables with actual values
        content = content.replace(/{workspace}/g, workspaceDir);
        content = content.replace(/{today}/g, today);
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
 * Build the Memory Recall section for system prompt
 *
 * This section instructs the agent to use memory_search before answering
 * questions about prior work, decisions, dates, people, preferences, or todos.
 */
export function buildMemoryRecallPrompt(): string {
  return `## Memory Recall

Before answering anything about prior work, decisions, dates, people, preferences, or todos:
1. Run \`memory_search\` on MEMORY.md + memory/*.md to find relevant snippets
2. Use \`memory_get\` to pull only the needed lines (keeps context small)
3. If low confidence after search, mention that you checked but found nothing relevant

Memory files:
- \`MEMORY.md\` - Long-term, curated memories (preferences, lessons learned, important context)
- \`memory/YYYY-MM-DD.md\` - Daily logs (what happened today, running context)

When to write memories:
- When someone says "remember this" → write to memory/YYYY-MM-DD.md
- When you learn something important → consider updating MEMORY.md
- "Mental notes" don't survive session restarts. Files do.

Citations: Include "Source: <path#Lline>" when it helps verify memory snippets.
`;
}

/**
 * Build context message for injection
 *
 * We inject:
 * - Workspace paths (working directory + personal workspace)
 * - AGENTS.md (if exists) - defines how the agent works
 * - Memory Recall instructions (if memory tools are available)
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
 * @param includeMemoryRecall - Whether to include memory recall instructions
 */
export function buildWorkspacePrompt(
  cwd: string,
  files: WorkspaceFile[],
  identity?: AgentIdentity,
  workspaceDir?: string,
  includeMemoryRecall: boolean = true
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

  // Include Memory Recall section
  if (includeMemoryRecall) {
    lines.push(buildMemoryRecallPrompt());
  }

  // Include AGENTS.md if present
  const agentsFile = files.find((f) => f.path.endsWith("AGENTS.md"));
  if (agentsFile) {
    lines.push("---", "", agentsFile.content, "");
  }

  return lines.join("\n");
}
