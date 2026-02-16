/**
 * Skill Create Tool
 *
 * Create a new skill with proper directory structure and SKILL.md template.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { IAgentManager } from "../managers/types.js";

// ─── Tool Parameters Schema ───────────────────────────────────

export const SkillCreateParams = Type.Object({
  name: Type.String({
    description:
      "Skill name. Use lowercase letters, digits, and hyphens only (e.g., 'pdf-editor', 'weather'). Must be under 64 characters.",
  }),
  description: Type.String({
    description:
      "Skill description. Include both what the skill does and specific triggers/contexts for when to use it. This is the primary triggering mechanism.",
  }),
  scope: Type.Optional(
    Type.Union([Type.Literal("global"), Type.Literal("agent")], {
      description: "Where to create the skill. 'global' (default) makes it available to all agents, 'agent' only to the current agent.",
    }),
  ),
  resources: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal("scripts"),
        Type.Literal("references"),
        Type.Literal("assets"),
      ]),
      {
        description: "Resource directories to create. Options: 'scripts', 'references', 'assets'.",
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

function normalizeSkillName(name: string): string {
  // Convert to lowercase, replace spaces and underscores with hyphens
  // Remove any characters that aren't letters, digits, or hyphens
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 64);
}

function validateSkillName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length === 0) {
    return { valid: false, error: "Skill name cannot be empty" };
  }
  if (name.length > 64) {
    return { valid: false, error: "Skill name must be under 64 characters" };
  }
  if (!/^[a-z0-9-]+$/.test(name)) {
    return { valid: false, error: "Skill name must only contain lowercase letters, digits, and hyphens" };
  }
  if (name.startsWith("-") || name.endsWith("-")) {
    return { valid: false, error: "Skill name cannot start or end with a hyphen" };
  }
  if (name.includes("--")) {
    return { valid: false, error: "Skill name cannot contain consecutive hyphens" };
  }
  return { valid: true };
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function generateSkillMdContent(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
---

# ${name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}

<!-- Add skill instructions here -->

## Usage

<!-- Describe how to use this skill -->

## Examples

<!-- Add example usage scenarios -->
`;
}

// ─── Tool Definition ───────────────────────────────────────

export function createSkillCreateTool(
  manager: IAgentManager,
  agentId: string,
): ToolDefinition {
  return {
    name: "skill_create",
    label: "Create Skill",
    description:
      "Create a new skill with proper directory structure and SKILL.md template. " +
      "Skills are modular packages that extend the agent's capabilities with specialized knowledge and workflows. " +
      "Use this tool when the user wants to create a new skill.",
    parameters: SkillCreateParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { name: rawName, description, scope = "global", resources = [] } = params as {
        name: string;
        description: string;
        scope?: "global" | "agent";
        resources?: ("scripts" | "references" | "assets")[];
      };

      try {
        // Normalize and validate skill name
        const name = normalizeSkillName(rawName);
        const validation = validateSkillName(name);

        if (!validation.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid skill name: ${validation.error}. Normalized name: "${name}"`,
              },
            ],
            details: undefined,
          };
        }

        // Determine target directory
        const skillsDir = scope === "agent" ? getAgentSkillsDir(agentId) : getGlobalSkillsDir();
        const skillPath = join(skillsDir, name);

        // Check if skill already exists
        if (await directoryExists(skillPath)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Skill "${name}" already exists at ${skillPath}. Use skill_update to modify an existing skill.`,
              },
            ],
            details: { skillPath, exists: true },
          };
        }

        // Create skill directory
        await mkdir(skillPath, { recursive: true });

        // Create resource directories if specified
        const createdDirs: string[] = [];
        for (const resource of resources) {
          const resourcePath = join(skillPath, resource);
          await mkdir(resourcePath, { recursive: true });
          createdDirs.push(resource);
        }

        // Generate and write SKILL.md
        const skillMdContent = generateSkillMdContent(name, description);
        await writeFile(join(skillPath, "SKILL.md"), skillMdContent, "utf-8");

        // Build success message
        let message = `Successfully created skill "${name}" at ${skillPath}\n\n`;
        message += `📁 Directory structure:\n`;
        message += `  ${name}/\n`;
        message += `  └── SKILL.md\n`;
        for (const dir of createdDirs) {
          message += `  └── ${dir}/\n`;
        }
        message += `\n📝 Next steps:\n`;
        message += `1. Edit SKILL.md to add skill instructions\n`;
        if (createdDirs.length > 0) {
          message += `2. Add resources to the created directories\n`;
        }
        message += `3. Test the skill with real usage\n`;
        message += `\nThe skill will be automatically loaded on the next agent turn.`;

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
            scope,
            createdDirs,
            description,
          },
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create skill: ${errorMsg}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
