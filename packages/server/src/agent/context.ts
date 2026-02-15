import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentIdentity } from "@friend/shared";

// All bootstrap files loaded directly into context (like picoclaw's context.go)
// Order: identity → soul → user preferences → workspace rules → tool notes → memory
const WORKSPACE_FILES = [
  "IDENTITY.md",
  "SOUL.md",
  "USER.md",
  "AGENTS.md",
  "TOOLS.md",
  "MEMORY.md",
] as const;

export type WorkspaceFile = { path: string; content: string };

/**
 * Load workspace files from a directory.
 * All bootstrap files (IDENTITY.md, SOUL.md, USER.md, AGENTS.md, TOOLS.md, MEMORY.md)
 * are loaded directly into context so the LLM doesn't need to read them via tool calls.
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
 * Build context message for injection.
 *
 * All bootstrap files, skills, and tools are loaded directly into the context.
 * The LLM does not need to read these files via tool calls.
 *
 * Sections:
 * 1. Identity & Environment (name, time, paths)
 * 2. Memory Recall instructions
 * 3. Bootstrap files (IDENTITY.md, SOUL.md, USER.md, AGENTS.md, TOOLS.md, MEMORY.md)
 * 4. Skills summary
 * 5. Custom tools summary
 *
 * @param cwd - Working directory (project path)
 * @param files - Workspace files (all bootstrap files)
 * @param identity - Agent identity for name
 * @param workspaceDir - Workspace directory path
 * @param includeMemoryRecall - Whether to include memory recall instructions
 * @param skills - Loaded skills summaries
 * @param tools - Custom tools summaries
 */
export function buildWorkspacePrompt(
  cwd: string,
  files: WorkspaceFile[],
  identity?: AgentIdentity,
  workspaceDir?: string,
  includeMemoryRecall: boolean = true,
  skills: Array<{ name: string; description: string }> = [],
  tools: Array<{ name: string; description: string }> = [],
): string {
  const sections: string[] = [];

  // 1. Identity & Runtime metadata
  const displayName = identity?.name || "Friend";
  const now = new Date();
  sections.push([
    "## Identity & Environment",
    `- Name: ${displayName}`,
    `- Current time: ${now.toISOString()}`,
    `- Working directory: ${cwd}`,
    `- Personal workspace: ${workspaceDir || cwd}`,
  ].join("\n"));

  // 2. Memory Recall instructions
  if (includeMemoryRecall) {
    sections.push(buildMemoryRecallPrompt());
  }

  // 3. All bootstrap files (IDENTITY.md, SOUL.md, USER.md, AGENTS.md, TOOLS.md, MEMORY.md)
  for (const file of files) {
    const name = file.path.split("/").pop() || file.path;
    sections.push(`<!-- ${name} -->\n${file.content}`);
  }

  // 4. Skills summary (name + description for each loaded skill)
  if (skills.length > 0) {
    const skillLines = skills.map(s => `- **${s.name}**: ${s.description}`);
    sections.push([
      "## Available Skills",
      "",
      "The following skills are loaded. Use them when relevant:",
      "",
      ...skillLines,
    ].join("\n"));
  }

  // 5. Custom tools summary (name + description)
  if (tools.length > 0) {
    const toolLines = tools.map(t => `- **${t.name}**: ${t.description}`);
    sections.push([
      "## Custom Tools",
      "",
      ...toolLines,
    ].join("\n"));
  }

  return sections.join("\n\n---\n\n");
}
