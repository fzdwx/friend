import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

export async function loadWorkspaceFiles(cwd: string): Promise<WorkspaceFile[]> {
  const friendDir = join(cwd, ".friend");
  const results: WorkspaceFile[] = [];
  for (const name of WORKSPACE_FILES) {
    try {
      let path = join(friendDir, name);
      const content = await readFile(path, "utf-8");
      if (content.trim()) {
        results.push({ path, content });
      }
    } catch {}
  }
  return results;
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

/** Build system prompt section from workspace files*/
export function buildWorkspacePrompt(cwd: string, files: WorkspaceFile[]): string {
  // Extract agent name from IDENTITY.md (if filled in)
  const identityFile = files.find((f) => f.path.endsWith("IDENTITY.md"));
  const agentName = identityFile ? parseIdentityName(identityFile.content) : undefined;
  const displayName = agentName || "Friend";

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
      `Your working directory is: ${cwd}`,
      "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
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
    lines.push("---");
    lines.push(`## ${file.path}`, "", file.content, "");
  }
  lines.push("---");

  return lines.join("\n");
}
