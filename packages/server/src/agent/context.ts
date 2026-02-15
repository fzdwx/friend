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

  for (const name of WORKSPACE_FILES) {
    try {
      const path = join(workspaceDir, name);
      let content = await readFile(path, "utf-8");
      if (content.trim()) {
        // Replace variables with actual values
        content = content.replace(/{workspace}/g, workspaceDir);
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
 * Build the Self-Scheduling section for system prompt.
 *
 * Teaches the agent it can wake itself up via cron + heartbeat,
 * and gives concrete patterns for when to self-schedule.
 */
export function buildSelfSchedulingPrompt(): string {
  return `## 主动调度

你拥有三种自我唤醒机制，可以在未来的某个时间点让自己执行任务：

### 机制

| 机制 | 适用场景 | 说明 |
|------|---------|------|
| \`cron\` 工具 | 精确定时 | 用 \`at_seconds\` 设置一次性定时器（如"10分钟后提醒我"），用 \`every_seconds\` 或 \`cron_expr\` 设置周期任务 |
| \`HEARTBEAT.md\` | 持久性职责 | 写入 HEARTBEAT.md 的任务会在每次心跳时被执行，适合需要反复检查的长期任务 |
| \`memory/\` | 为未来的自己留上下文 | 调度任务前，先把相关上下文写入 memory/YYYY-MM-DD.md，这样未来被唤醒时能理解为什么要做这件事 |

### 何时主动调度

- **延迟任务**：用户说"晚点"、"一会儿"、"10分钟后" → 用 cron \`at_seconds\`
- **跟进检查**：做完一件事后需要验证效果 → 用 cron 安排几分钟后检查
- **周期监控**：需要持续关注某件事 → 用 cron \`every_seconds\` 或写入 HEARTBEAT.md
- **用户提醒**：用户明确要求提醒 → 用 cron \`at_seconds\`，message 写成提醒语气

### 关键模式：先写上下文，再调度

\`\`\`
1. 把任务背景写入 memory/YYYY-MM-DD.md（为什么要做、做什么、相关信息）
2. 调用 cron 工具设置定时任务，message 中引用 memory 条目
3. 确认任务已安排，告知用户预计触发时间
\`\`\`

不要犹豫——如果一个任务不需要立即完成，主动安排到合适的时间。
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
 * 3. Self-Scheduling guidance
 * 4. Bootstrap files (IDENTITY.md, SOUL.md, USER.md, AGENTS.md, TOOLS.md, MEMORY.md)
 * 5. Skills summary
 * 6. Custom tools summary
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

  // 3. Self-Scheduling guidance
  sections.push(buildSelfSchedulingPrompt());

  // 4. All bootstrap files (IDENTITY.md, SOUL.md, USER.md, AGENTS.md, TOOLS.md, MEMORY.md)
  for (const file of files) {
    const name = file.path.split("/").pop() || file.path;
    sections.push(`<!-- ${name} -->\n${file.content}`);
  }

  // 5. Skills summary (name + description for each loaded skill)
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

  // 6. Custom tools summary (name + description)
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
