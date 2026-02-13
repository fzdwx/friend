import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { existsSync } from "node:fs";
import type { AgentIdentity } from "@friend/shared";

const WORKSPACE_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "IDENTITY.md",
  "USER.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
] as const;

export type WorkspaceFile = { path: string; content: string };

/**
 * Load workspace files from a directory
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

/** Extract the Name field from IDENTITY.md content */
function parseIdentityName(content: string): string | undefined {
  const match = content.match(/\*\*Name:\*\*\s*(.+)/);
  if (!match) return undefined;
  const name = match[1].trim();
  // Skip placeholder / empty values
  if (!name || name.startsWith("*") || name.startsWith("(")) return undefined;
  return name;
}

/**
 * Build system prompt section from workspace files
 * 
 * @param cwd - Working directory (project path)
 * @param files - Workspace files to include
 * @param identity - Optional resolved identity (takes precedence over IDENTITY.md)
 * @param workspaceDir - Optional workspace directory path (for memory files, etc.)
 */
export function buildWorkspacePrompt(
  cwd: string,
  files: WorkspaceFile[],
  identity?: AgentIdentity,
  workspaceDir?: string
): string {
  // Extract agent name from resolved identity or IDENTITY.md
  let displayName = "Friend";
  
  if (identity?.name) {
    displayName = identity.name;
  } else {
    const identityFile = files.find((f) => f.path.endsWith("IDENTITY.md"));
    const agentName = identityFile ? parseIdentityName(identityFile.content) : undefined;
    if (agentName) {
      displayName = agentName;
    }
  }

  const lines: string[] = [
    `[IDENTITY] You are "${displayName}", a personal assistant running inside Friend.`,
    `You are NOT Claude, NOT ChatGPT, NOT any other AI product.`,
    `When asked who you are, say you are ${displayName}.`,
    `Never claim to be made by Anthropic, OpenAI, or any other company.`,
    "",
  ];

  if (files.length === 0) return lines.join("\n");

  lines.push(
    ...[
      "## Workspace",
      `- Working directory: ${cwd}`,
      `- Personal workspace: ${workspaceDir || cwd}`,
      "",
      "The **working directory** is where you operate on project files.",
      "The **personal workspace** is where you store memories, notes, and agent-specific files.",
    ],
  );

  const hasSoul = files.some((f) => f.path.endsWith("SOUL.md"));
  if (hasSoul) {
    lines.push(
      "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.",
    );
  }
  lines.push("");

  for (const file of files) {
    // Use basename for cleaner display
    const displayPath = basename(file.path);
    lines.push("---");
    lines.push(`## ${displayPath}`, "", file.content, "");
  }
  lines.push("---");

  return lines.join("\n");
}
