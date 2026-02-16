/**
 * Builtin Skills Initialization
 *
 * Ensures built-in skills are created in the global skills directory
 * if they don't already exist.
 *
 * Each skill is a directory with SKILL.md and optional resources:
 * - builtin-skills/skill-name/SKILL.md.txt (required)
 * - builtin-skills/skill-name/scripts/*.txt (optional)
 * - builtin-skills/skill-name/references/*.txt (optional)
 * - builtin-skills/skill-name/assets/* (optional)
 *
 * Uses import to inline content (works after bundling).
 */

import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { GLOBAL_SKILLS_DIR } from "../paths.js";

// Import skill content (inlined by Bun at build time)
import skillCreatorMd from "./skill-creator/SKILL.md.txt";
import agentBrowserMd from "./agent-browser/SKILL.md.txt";

// Built-in skill definitions with their resources
const BUILTIN_SKILLS = {
  "skill-creator": {
    "SKILL.md": skillCreatorMd,
    // Add more files as needed:
    // "scripts/rotate.py": rotatePy,
    // "references/schema.md": schemaMd,
  },
  "agent-browser": {
    "SKILL.md": agentBrowserMd,
  },
} as const;

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

    // Only create if doesn't exist
    if (!existsSync(skillFile)) {
      // Create skill directory
      mkdirSync(skillDir, { recursive: true });

      // Write all files
      for (const [filePath, content] of Object.entries(files)) {
        const fullPath = join(skillDir, filePath);
        const parentDir = join(fullPath, "..");

        // Ensure parent directory exists
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true });
        }

        writeFileSync(fullPath, content, "utf-8");
      }

      console.log(`✓ Created built-in skill: ${skillName}`);
    }
  }
}
