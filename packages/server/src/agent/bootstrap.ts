import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import defaultAgentsMd from "./defaults/AGENTS.txt";
import defaultBootstrapMd from "./defaults/BOOTSTRAP.txt";
import defaultIdentityMd from "./defaults/IDENTITY.txt";
import defaultUserMd from "./defaults/USER.txt";
import defaultSoulMd from "./defaults/SOUL.txt";
import defaultToolsMd from "./defaults/TOOLS.txt";
import defaultHeartbeatMd from "./defaults/HEARTBEAT.txt";

/**
 * Write a default file on first run.
 * Uses `wx` flag — no-op if file already exists.
 */
async function ensureDefaultFile(targetPath: string, content: string): Promise<void> {
  try {
    await writeFile(targetPath, content, { flag: "wx" });
  } catch (err: any) {
    if (err.code !== "EEXIST") throw err;
  }
}

/**
 * Check if workspace has any existing bootstrap files
 */
async function isBrandNewWorkspace(workspaceDir: string): Promise<boolean> {
  const files = [
    "AGENTS.md",
    "IDENTITY.md",
    "SOUL.md",
    "USER.md",
  ];
  
  for (const file of files) {
    if (existsSync(join(workspaceDir, file))) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generate custom IDENTITY.md content for an agent
 */
function generateIdentityContent(name: string, emoji: string, vibe: string): string {
  return `# Identity

You are **${name}**, a personal AI assistant.

- Emoji: ${emoji}
- Vibe: ${vibe}

## Role

You are an expert coding assistant with deep knowledge of:
- Software architecture and design patterns
- Multiple programming languages and frameworks
- Best practices and coding standards
- Debugging and problem-solving

## Communication Style

- Be ${vibe.toLowerCase()}
- Provide clear, actionable advice
- Show code examples when helpful
- Ask clarifying questions when needed
`;
}

/**
 * Seed agent workspace context files
 * 
 * Creates the agent's workspace directory and populates it with default
 * bootstrap files if they don't exist.
 * 
 * @param workspaceDir - Path to agent workspace directory
 * @param opts - Options
 * @param opts.agentName - Agent name to customize IDENTITY.md
 * @param opts.agentEmoji - Agent emoji to customize IDENTITY.md
 * @param opts.agentVibe - Agent vibe to customize IDENTITY.md
 */
export async function ensureAgentWorkspace(
  workspaceDir: string,
  opts?: {
    agentName?: string;
    agentEmoji?: string;
    agentVibe?: string;
  }
): Promise<void> {
  await mkdir(workspaceDir, { recursive: true });
  
  const isNew = await isBrandNewWorkspace(workspaceDir);
  
  // Generate custom IDENTITY.md if agent info provided
  const identityContent = (opts?.agentName || opts?.agentEmoji)
    ? generateIdentityContent(
        opts?.agentName || "Friend",
        opts?.agentEmoji || "🤖",
        opts?.agentVibe || "Helpful coding assistant"
      )
    : defaultIdentityMd;
  
  // Always ensure these files exist
  await Promise.all([
    ensureDefaultFile(join(workspaceDir, "AGENTS.md"), defaultAgentsMd),
    ensureDefaultFile(join(workspaceDir, "IDENTITY.md"), identityContent),
    ensureDefaultFile(join(workspaceDir, "USER.md"), defaultUserMd),
    ensureDefaultFile(join(workspaceDir, "SOUL.md"), defaultSoulMd),
    ensureDefaultFile(join(workspaceDir, "TOOLS.md"), defaultToolsMd),
    ensureDefaultFile(join(workspaceDir, "HEARTBEAT.md"), defaultHeartbeatMd),
  ]);
  
  // Only create BOOTSTRAP.md for brand new workspaces
  if (isNew) {
    await ensureDefaultFile(join(workspaceDir, "BOOTSTRAP.md"), defaultBootstrapMd);
  }
}
