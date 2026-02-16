/**
 * Builtin Skills Initialization
 *
 * Ensures built-in skills are created in the global skills directory
 * if they don't already exist.
 *
 * Each skill is a directory with SKILL.md and optional resources:
 * - builtin-skills/skill-name/SKILL.md.txt (required)
 * - builtin-skills/skill-name/references/*.md (optional)
 * - builtin-skills/skill-name/templates/*.sh (optional)
 *
 * Uses import to inline SKILL.md content (works after bundling).
 * Reference/template files are copied from source directory at runtime.
 */

import { join, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { GLOBAL_SKILLS_DIR } from "../paths.js";

// Import skill content (inlined by Bun at build time)
import skillCreatorMd from "./skill-creator/SKILL.md.txt";
import agentBrowserMd from "./agent-browser/SKILL.md.txt";

// Built-in skill definitions with their SKILL.md content
const BUILTIN_SKILLS = {
  "skill-creator": {
    "SKILL.md": skillCreatorMd,
  },
  "agent-browser": {
    "SKILL.md": agentBrowserMd,
  },
} as const;

// Skills with additional resource directories to copy
const SKILL_RESOURCES: Record<string, string[]> = {
  "agent-browser": ["references", "templates"],
};

/**
 * Get the source directory for a skill's resources
 */
function getSkillSourceDir(skillName: string): string {
  return join(__dirname, skillName);
}

/**
 * Copy a directory recursively
 */
function copyDir(src: string, dest: string): void {
  if (!existsSync(src)) return;

  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Ensure all built-in skills exist in the global skills directory.
 * Creates them if they don't exist.
 */
export function ensureBuiltinSkills(): void {
  // Ensure global skills directory exists
  if (!existsSync(GLOBAL_SKILLS_DIR)) {
    mkdirSync(GLOBAL_SKILLS_DIR, { recursive: true });
  }

  // Check and create each built-in skill
  for (const [skillName, files] of Object.entries(BUILTIN_SKILLS)) {
    const skillDir = join(GLOBAL_SKILLS_DIR, skillName);
    const skillFile = join(skillDir, "SKILL.md");

    // Only create if SKILL.md doesn't exist
    if (!existsSync(skillFile)) {
      // Create skill directory
      mkdirSync(skillDir, { recursive: true });

      // Write SKILL.md
      for (const [filePath, content] of Object.entries(files)) {
        const fullPath = join(skillDir, filePath);
        const parentDir = dirname(fullPath);

        // Ensure parent directory exists
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true });
        }

        writeFileSync(fullPath, content, "utf-8");
      }

      // Copy resource directories if they exist
      const resourceDirs = SKILL_RESOURCES[skillName];
      if (resourceDirs) {
        const sourceDir = getSkillSourceDir(skillName);
        for (const resourceDir of resourceDirs) {
          const srcPath = join(sourceDir, resourceDir);
          const destPath = join(skillDir, resourceDir);
          copyDir(srcPath, destPath);
        }
      }

      console.log(`✓ Created built-in skill: ${skillName}`);
    }
  }
}
