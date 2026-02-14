/**
 * Builtin Skills Initialization
 *
 * Ensures built-in skills are created in the global skills directory
 * if they don't already exist.
 */

import { join, dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GLOBAL_SKILLS_DIR } from "../paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Built-in skill names (content loaded from .txt files)
const BUILTIN_SKILL_NAMES = [
  "skill-creator",
];

/**
 * Load skill content from .txt file
 */
function loadSkillContent(skillName: string): string {
  const skillFile = join(__dirname, `${skillName}.txt`);
  return readFileSync(skillFile, "utf-8");
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
  for (const skillName of BUILTIN_SKILL_NAMES) {
    const skillDir = join(GLOBAL_SKILLS_DIR, skillName);
    const skillFile = join(skillDir, "SKILL.md");

    // Only create if doesn't exist
    if (!existsSync(skillFile)) {
      mkdirSync(skillDir, { recursive: true });
      
      const skillContent = loadSkillContent(skillName);
      writeFileSync(skillFile, skillContent, "utf-8");
      
      console.log(`✓ Created built-in skill: ${skillName}`);
    }
  }
}
