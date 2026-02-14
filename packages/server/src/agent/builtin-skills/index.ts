/**
 * Builtin Skills Initialization
 *
 * Ensures built-in skills are created in the global skills directory
 * if they don't already exist.
 *
 * Uses import to inline skill content (works after bundling, same pattern as defaults/)
 */

import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { GLOBAL_SKILLS_DIR } from "../paths.js";

// Import builtin skill content (inlined by Bun at build time)
import skillCreatorMd from "./skill-creator.txt";

// Built-in skill definitions
const BUILTIN_SKILLS = {
  "skill-creator": skillCreatorMd,
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
  for (const [skillName, skillContent] of Object.entries(BUILTIN_SKILLS)) {
    const skillDir = join(GLOBAL_SKILLS_DIR, skillName);
    const skillFile = join(skillDir, "SKILL.md");

    // Only create if doesn't exist
    if (!existsSync(skillFile)) {
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(skillFile, skillContent, "utf-8");
      console.log(`✓ Created built-in skill: ${skillName}`);
    }
  }
}
