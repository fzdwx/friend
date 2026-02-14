/**
 * Builtin Skills Initialization
 *
 * Ensures built-in skills are created in the global skills directory
 * if they don't already exist.
 *
 * Built-in skills are organized in subdirectories:
 * - builtin-skills/skill-name/SKILL.md
 * - builtin-skills/skill-name/scripts/
 * - builtin-skills/skill-name/references/
 * - builtin-skills/skill-name/assets/
 */

import { join, dirname } from "node:path";
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GLOBAL_SKILLS_DIR } from "../paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Recursively copy a directory
 */
function copyDir(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Get list of built-in skill directories
 */
function getBuiltinSkillDirs(): string[] {
  const entries = readdirSync(__dirname, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
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

  // Get all built-in skill directories
  const skillDirs = getBuiltinSkillDirs();

  // Check and create each built-in skill
  for (const skillName of skillDirs) {
    const srcDir = join(__dirname, skillName);
    const destDir = join(GLOBAL_SKILLS_DIR, skillName);
    const destFile = join(destDir, "SKILL.md");

    // Only create if doesn't exist
    if (!existsSync(destFile)) {
      copyDir(srcDir, destDir);
      console.log(`✓ Created built-in skill: ${skillName}`);
    }
  }
}
