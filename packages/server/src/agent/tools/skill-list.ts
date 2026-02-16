/**
 * Skill List Tool
 *
 * List all available skills from global and agent scopes.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { readdir, readFile, access, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { IAgentManager } from "../managers/types.js";

// ─── Tool Parameters Schema ───────────────────────────────────

export const SkillListParams = Type.Object({
  scope: Type.Optional(
    Type.Union([Type.Literal("global"), Type.Literal("agent"), Type.Literal("all")], {
      description: "Which scope to list skills from. 'all' (default) lists both global and agent skills.",
    }),
  ),
  include_resources: Type.Optional(
    Type.Boolean({
      description: "Include resource directory information. Default: false.",
    }),
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

interface SkillInfo {
  name: string;
  description: string;
  path: string;
  scope: "global" | "agent";
  hasResources: {
    scripts: boolean;
    references: boolean;
    assets: boolean;
  };
  resourceCounts?: {
    scripts: number;
    references: number;
    assets: number;
  };
}

async function countFilesInDir(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

async function parseSkillMd(skillPath: string): Promise<{ name: string; description: string }> {
  const skillMdPath = join(skillPath, "SKILL.md");
  try {
    const content = await readFile(skillMdPath, "utf-8");

    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return { name: "", description: "" };
    }

    const frontmatter = frontmatterMatch[1];
    let name = "";
    let description = "";

    for (const line of frontmatter.split("\n")) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (key === "name") name = value;
        if (key === "description") description = value;
      }
    }

    return { name, description };
  } catch {
    return { name: "", description: "" };
  }
}

async function listSkillsFromDir(
  dir: string,
  scope: "global" | "agent",
  includeResources: boolean,
): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];

  if (!(await directoryExists(dir))) {
    return skills;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = join(dir, entry.name);
      const skillMdPath = join(skillPath, "SKILL.md");

      // Check if SKILL.md exists
      if (!(await directoryExists(skillMdPath).catch(() => false))) {
        // Try to read it as a file
        try {
          await access(skillMdPath);
        } catch {
          continue; // Skip directories without SKILL.md
        }
      }

      const { name, description } = await parseSkillMd(skillPath);

      // Check for resource directories
      const hasResources = {
        scripts: await directoryExists(join(skillPath, "scripts")),
        references: await directoryExists(join(skillPath, "references")),
        assets: await directoryExists(join(skillPath, "assets")),
      };

      const skillInfo: SkillInfo = {
        name: name || entry.name,
        description: description || "(no description)",
        path: skillPath,
        scope,
        hasResources,
      };

      if (includeResources) {
        skillInfo.resourceCounts = {
          scripts: hasResources.scripts ? await countFilesInDir(join(skillPath, "scripts")) : 0,
          references: hasResources.references ? await countFilesInDir(join(skillPath, "references")) : 0,
          assets: hasResources.assets ? await countFilesInDir(join(skillPath, "assets")) : 0,
        };
      }

      skills.push(skillInfo);
    }
  } catch {
    // Directory read error, return empty list
  }

  return skills;
}

// ─── Tool Definition ───────────────────────────────────────

export function createSkillListTool(
  manager: IAgentManager,
  agentId: string,
): ToolDefinition {
  return {
    name: "skill_list",
    label: "List Skills",
    description:
      "List all available skills from global and agent scopes. " +
      "Shows skill names, descriptions, and optionally resource directory information. " +
      "Use this tool when the user wants to see what skills are available.",
    parameters: SkillListParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { scope = "all", include_resources = false } = params as {
        scope?: "global" | "agent" | "all";
        include_resources?: boolean;
      };

      try {
        const allSkills: SkillInfo[] = [];

        // List global skills
        if (scope === "all" || scope === "global") {
          const globalSkills = await listSkillsFromDir(
            getGlobalSkillsDir(),
            "global",
            include_resources,
          );
          allSkills.push(...globalSkills);
        }

        // List agent skills
        if (scope === "all" || scope === "agent") {
          const agentSkills = await listSkillsFromDir(
            getAgentSkillsDir(agentId),
            "agent",
            include_resources,
          );
          allSkills.push(...agentSkills);
        }

        if (allSkills.length === 0) {
          const scopeHint = scope === "all" ? "" : ` in ${scope} scope`;
          return {
            content: [
              {
                type: "text" as const,
                text: `No skills found${scopeHint}.\n\nUse skill_create to create a new skill.`,
              },
            ],
            details: { skills: [], scope },
          };
        }

        // Build output
        let message = `Found ${allSkills.length} skill${allSkills.length === 1 ? "" : "s"}:\n\n`;

        // Group by scope
        const globalSkills = allSkills.filter((s) => s.scope === "global");
        const agentSkills = allSkills.filter((s) => s.scope === "agent");

        if (globalSkills.length > 0) {
          message += `🌍 Global Skills (${globalSkills.length}):\n`;
          for (const skill of globalSkills) {
            const resourceInfo = formatResourceInfo(skill, include_resources);
            message += `  • ${skill.name}${resourceInfo}\n`;
            message += `    ${skill.description.slice(0, 80)}${skill.description.length > 80 ? "..." : ""}\n`;
          }
          message += "\n";
        }

        if (agentSkills.length > 0) {
          message += `🤖 Agent Skills (${agentSkills.length}):\n`;
          for (const skill of agentSkills) {
            const resourceInfo = formatResourceInfo(skill, include_resources);
            message += `  • ${skill.name}${resourceInfo}\n`;
            message += `    ${skill.description.slice(0, 80)}${skill.description.length > 80 ? "..." : ""}\n`;
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
            skills: allSkills.map((s) => ({
              name: s.name,
              description: s.description,
              scope: s.scope,
              path: s.path,
              hasResources: s.hasResources,
              resourceCounts: s.resourceCounts,
            })),
            totalCount: allSkills.length,
            globalCount: globalSkills.length,
            agentCount: agentSkills.length,
          },
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list skills: ${errorMsg}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}

function formatResourceInfo(skill: SkillInfo, includeResources: boolean): string {
  const resources: string[] = [];

  if (skill.hasResources.scripts) resources.push("scripts");
  if (skill.hasResources.references) resources.push("references");
  if (skill.hasResources.assets) resources.push("assets");

  if (resources.length === 0) return "";

  if (includeResources && skill.resourceCounts) {
    const counts = resources.map((r) => {
      const count = skill.resourceCounts![r as keyof typeof skill.resourceCounts];
      return `${r}:${count}`;
    });
    return ` [${counts.join(", ")}]`;
  }

  return ` [${resources.join(", ")}]`;
}
