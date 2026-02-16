/**
 * Skill Update Tool
 *
 * Update an existing skill's metadata and content.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { mkdir, writeFile, readFile, access, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { IAgentManager } from "../managers/types.js";

// ─── Tool Parameters Schema ───────────────────────────────────

export const SkillUpdateParams = Type.Object({
  name: Type.String({
    description: "Name of the skill to update.",
  }),
  description: Type.Optional(
    Type.String({
      description: "New description for the skill. Updates the SKILL.md frontmatter.",
    }),
  ),
  scope: Type.Optional(
    Type.Union([Type.Literal("global"), Type.Literal("agent")], {
      description: "Which scope to search for the skill. If not specified, searches both global and agent scopes.",
    }),
  ),
  content: Type.Optional(
    Type.String({
      description: "New content for SKILL.md body (everything after frontmatter). Replaces existing body content.",
    }),
  ),
  add_resources: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal("scripts"),
        Type.Literal("references"),
        Type.Literal("assets"),
      ]),
      {
        description: "Resource directories to create if they don't exist.",
      },
    ),
  ),
  remove_resources: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal("scripts"),
        Type.Literal("references"),
        Type.Literal("assets"),
      ]),
      {
        description: "Resource directories to remove. WARNING: This deletes all files in the directory.",
      },
    ),
  ),
});

// ─── Helper Functions ────────────────────────────────────────

function getConfigDir(): string {
  const home = homedir();
  return join(home, ".config", "friend");
}

function getGlobalSkillsDir(): string {
  return join(getConfigDir(), "skills");
}

function getAgentSkillsDir(agentId: string): string {
  return join(getConfigDir(), "agents", agentId, "skills");
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findSkillDir(
  name: string,
  agentId: string,
  scope?: "global" | "agent",
): Promise<{ path: string; scope: "global" | "agent" } | null> {
  // If scope specified, only search that scope
  if (scope === "global") {
    const globalPath = join(getGlobalSkillsDir(), name);
    if (await directoryExists(globalPath)) {
      return { path: globalPath, scope: "global" };
    }
    return null;
  }

  if (scope === "agent") {
    const agentPath = join(getAgentSkillsDir(agentId), name);
    if (await directoryExists(agentPath)) {
      return { path: agentPath, scope: "agent" };
    }
    return null;
  }

  // Search both scopes (agent first, then global)
  const agentPath = join(getAgentSkillsDir(agentId), name);
  if (await directoryExists(agentPath)) {
    return { path: agentPath, scope: "agent" };
  }

  const globalPath = join(getGlobalSkillsDir(), name);
  if (await directoryExists(globalPath)) {
    return { path: globalPath, scope: "global" };
  }

  return null;
}

interface ParsedSkillMd {
  frontmatter: {
    name: string;
    description: string;
  };
  body: string;
  raw: string;
}

function parseSkillMd(content: string): ParsedSkillMd {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    // No valid frontmatter, treat entire content as body
    return {
      frontmatter: { name: "", description: "" },
      body: content,
      raw: content,
    };
  }

  const frontmatterStr = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  // Parse YAML frontmatter (simple key: value parsing)
  const frontmatter: { name: string; description: string } = { name: "", description: "" };

  for (const line of frontmatterStr.split("\n")) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (key === "name") frontmatter.name = value;
      if (key === "description") frontmatter.description = value;
    }
  }

  return {
    frontmatter,
    body,
    raw: content,
  };
}

function generateUpdatedSkillMd(parsed: ParsedSkillMd, newDescription?: string, newBody?: string): string {
  const description = newDescription ?? parsed.frontmatter.description;
  const body = newBody ?? parsed.body;

  return `---
name: ${parsed.frontmatter.name}
description: ${description}
---

${body}`;
}

async function listResourceFiles(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir, { recursive: true, withFileTypes: true });
    return files
      .filter((f) => f.isFile())
      .map((f) => join(f.parentPath || dir, f.name).replace(dir + "/", ""));
  } catch {
    return [];
  }
}

// ─── Tool Definition ───────────────────────────────────────

export function createSkillUpdateTool(
  manager: IAgentManager,
  agentId: string,
): ToolDefinition {
  return {
    name: "skill_update",
    label: "Update Skill",
    description:
      "Update an existing skill's metadata and content. " +
      "Can update description, body content, and manage resource directories. " +
      "Use this tool when the user wants to modify an existing skill.",
    parameters: SkillUpdateParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const {
        name,
        description,
        scope,
        content,
        add_resources = [],
        remove_resources = [],
      } = params as {
        name: string;
        description?: string;
        scope?: "global" | "agent";
        content?: string;
        add_resources?: ("scripts" | "references" | "assets")[];
        remove_resources?: ("scripts" | "references" | "assets")[];
      };

      try {
        // Find the skill
        const skillDir = await findSkillDir(name, agentId, scope);

        if (!skillDir) {
          const scopeHint = scope ? ` in ${scope} scope` : "";
          return {
            content: [
              {
                type: "text" as const,
                text: `Skill "${name}" not found${scopeHint}. Use skill_create to create a new skill, or check the skill name.`,
              },
            ],
            details: { name, found: false },
          };
        }

        const { path: skillPath, scope: foundScope } = skillDir;
        const skillMdPath = join(skillPath, "SKILL.md");
        const changes: string[] = [];

        // Read and parse existing SKILL.md
        let skillMdContent: string;
        try {
          skillMdContent = await readFile(skillMdPath, "utf-8");
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: `Skill directory exists but SKILL.md is missing at ${skillMdPath}. This may be a corrupted skill.`,
              },
            ],
            details: { skillPath, error: "missing_skill_md" },
          };
        }

        const parsed = parseSkillMd(skillMdContent);

        // Update SKILL.md if description or content changed
        if (description !== undefined || content !== undefined) {
          const updatedContent = generateUpdatedSkillMd(parsed, description, content);
          await writeFile(skillMdPath, updatedContent, "utf-8");

          if (description !== undefined) {
            changes.push(`description: "${parsed.frontmatter.description.slice(0, 50)}..." → "${description.slice(0, 50)}..."`);
          }
          if (content !== undefined) {
            changes.push("SKILL.md body content updated");
          }
        }

        // Create resource directories
        for (const resource of add_resources) {
          const resourcePath = join(skillPath, resource);
          if (!(await directoryExists(resourcePath))) {
            await mkdir(resourcePath, { recursive: true });
            changes.push(`created directory: ${resource}/`);
          }
        }

        // Remove resource directories
        for (const resource of remove_resources) {
          const resourcePath = join(skillPath, resource);
          if (await directoryExists(resourcePath)) {
            await rm(resourcePath, { recursive: true, force: true });
            changes.push(`removed directory: ${resource}/`);
          }
        }

        // Build response
        if (changes.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No changes specified for skill "${name}". Provide at least one field to update.`,
              },
            ],
            details: { name, skillPath, changes: [] },
          };
        }

        // List current resources
        const currentResources: Record<string, string[]> = {};
        for (const resource of ["scripts", "references", "assets"]) {
          const resourcePath = join(skillPath, resource);
          if (await directoryExists(resourcePath)) {
            const files = await listResourceFiles(resourcePath);
            if (files.length > 0) {
              currentResources[resource] = files;
            }
          }
        }

        let message = `Successfully updated skill "${name}" (${foundScope} scope)\n\n`;
        message += `📁 Path: ${skillPath}\n\n`;
        message += `📝 Changes:\n${changes.map((c) => `  - ${c}`).join("\n")}\n`;

        if (Object.keys(currentResources).length > 0) {
          message += `\n📊 Current resources:\n`;
          for (const [resource, files] of Object.entries(currentResources)) {
            message += `  ${resource}/ (${files.length} files)\n`;
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: message,
            },
          ],
          details: {
            name,
            skillPath,
            scope: foundScope,
            changes,
            currentResources,
          },
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to update skill: ${errorMsg}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
