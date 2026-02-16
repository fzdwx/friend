/**
 * Skill Validator
 *
 * Validate skill format, structure, and content.
 */

import { access, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────

export interface SkillValidationResult {
  valid: boolean;
  errors: SkillValidationError[];
  warnings: SkillValidationWarning[];
  info: SkillValidationInfo;
}

export interface SkillValidationError {
  code: string;
  message: string;
  location?: string;
}

export interface SkillValidationWarning {
  code: string;
  message: string;
  location?: string;
}

export interface SkillValidationInfo {
  name: string;
  description: string;
  path: string;
  hasResources: {
    scripts: boolean;
    references: boolean;
    assets: boolean;
  };
  bodyLength: number;
}

// ─── Error Codes ─────────────────────────────────────────────

export const SkillValidationCodes = {
  // Errors
  SKILL_NOT_FOUND: "SKILL_NOT_FOUND",
  SKILL_MD_MISSING: "SKILL_MD_MISSING",
  FRONTMATTER_INVALID: "FRONTMATTER_INVALID",
  FRONTMATTER_MISSING_NAME: "FRONTMATTER_MISSING_NAME",
  FRONTMATTER_MISSING_DESCRIPTION: "FRONTMATTER_MISSING_DESCRIPTION",
  NAME_INVALID_FORMAT: "NAME_INVALID_FORMAT",
  NAME_TOO_LONG: "NAME_TOO_LONG",
  DESCRIPTION_TOO_SHORT: "DESCRIPTION_TOO_SHORT",
  DESCRIPTION_TOO_LONG: "DESCRIPTION_TOO_LONG",
  BODY_EMPTY: "BODY_EMPTY",

  // Warnings
  DESCRIPTION_MISSING_TRIGGERS: "DESCRIPTION_MISSING_TRIGGERS",
  BODY_TOO_SHORT: "BODY_TOO_SHORT",
  EXTRA_FILES_IN_ROOT: "EXTRA_FILES_IN_ROOT",
  EMPTY_RESOURCE_DIR: "EMPTY_RESOURCE_DIR",
} as const;

// ─── Validation Functions ────────────────────────────────────

/**
 * Validate a skill name format
 */
export function validateSkillName(name: string): SkillValidationError[] {
  const errors: SkillValidationError[] = [];

  if (!name || name.length === 0) {
    errors.push({
      code: SkillValidationCodes.NAME_INVALID_FORMAT,
      message: "Skill name cannot be empty",
    });
    return errors;
  }

  if (name.length > 64) {
    errors.push({
      code: SkillValidationCodes.NAME_TOO_LONG,
      message: `Skill name must be under 64 characters (got ${name.length})`,
    });
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    errors.push({
      code: SkillValidationCodes.NAME_INVALID_FORMAT,
      message: "Skill name must only contain lowercase letters, digits, and hyphens",
    });
  }

  if (name.startsWith("-") || name.endsWith("-")) {
    errors.push({
      code: SkillValidationCodes.NAME_INVALID_FORMAT,
      message: "Skill name cannot start or end with a hyphen",
    });
  }

  if (name.includes("--")) {
    errors.push({
      code: SkillValidationCodes.NAME_INVALID_FORMAT,
      message: "Skill name cannot contain consecutive hyphens",
    });
  }

  return errors;
}

/**
 * Validate a skill description
 */
export function validateSkillDescription(description: string): {
  errors: SkillValidationError[];
  warnings: SkillValidationWarning[];
} {
  const errors: SkillValidationError[] = [];
  const warnings: SkillValidationWarning[] = [];

  if (!description || description.length === 0) {
    errors.push({
      code: SkillValidationCodes.FRONTMATTER_MISSING_DESCRIPTION,
      message: "Skill description is required",
    });
    return { errors, warnings };
  }

  if (description.length < 20) {
    errors.push({
      code: SkillValidationCodes.DESCRIPTION_TOO_SHORT,
      message: `Skill description should be at least 20 characters (got ${description.length}). Include what the skill does and when to use it.`,
    });
  }

  if (description.length > 500) {
    warnings.push({
      code: SkillValidationCodes.DESCRIPTION_TOO_LONG,
      message: `Skill description is very long (${description.length} characters). Consider keeping it under 500 characters for better readability.`,
    });
  }

  // Check for trigger words in description
  const triggerPatterns = [
    /use (when|for|to)/i,
    /(trigger|triggers)/i,
    /helpful (for|when)/i,
    /call (this|when)/i,
  ];

  const hasTriggers = triggerPatterns.some((pattern) => pattern.test(description));
  if (!hasTriggers) {
    warnings.push({
      code: SkillValidationCodes.DESCRIPTION_MISSING_TRIGGERS,
      message: "Description should include when to use this skill (e.g., 'Use when...', 'Triggers when...')",
    });
  }

  return { errors, warnings };
}

/**
 * Parse and validate SKILL.md frontmatter
 */
export function parseSkillMd(content: string): {
  frontmatter: { name: string; description: string };
  body: string;
  raw: string;
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return {
      frontmatter: { name: "", description: "" },
      body: content,
      raw: content,
    };
  }

  const frontmatterStr = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  const frontmatter: { name: string; description: string } = { name: "", description: "" };

  for (const line of frontmatterStr.split("\n")) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (key === "name") frontmatter.name = value;
      if (key === "description") frontmatter.description = value;
    }
  }

  return { frontmatter, body, raw: content };
}

/**
 * Validate SKILL.md content
 */
export async function validateSkillMd(skillPath: string): Promise<{
  errors: SkillValidationError[];
  warnings: SkillValidationWarning[];
  frontmatter: { name: string; description: string };
  body: string;
}> {
  const errors: SkillValidationError[] = [];
  const warnings: SkillValidationWarning[] = [];
  let frontmatter = { name: "", description: "" };
  let body = "";

  const skillMdPath = join(skillPath, "SKILL.md");

  try {
    const content = await readFile(skillMdPath, "utf-8");
    const parsed = parseSkillMd(content);
    frontmatter = parsed.frontmatter;
    body = parsed.body;

    // Check frontmatter exists
    if (!parsed.frontmatter.name && !parsed.frontmatter.description) {
      // Check if it looks like there's no frontmatter at all
      if (!content.startsWith("---")) {
        errors.push({
          code: SkillValidationCodes.FRONTMATTER_INVALID,
          message: "SKILL.md is missing YAML frontmatter. Add '---' delimiters at the beginning.",
          location: skillMdPath,
        });
      } else {
        errors.push({
          code: SkillValidationCodes.FRONTMATTER_INVALID,
          message: "SKILL.md frontmatter is missing 'name' and 'description' fields",
          location: skillMdPath,
        });
      }
    } else {
      // Validate name
      if (!parsed.frontmatter.name) {
        errors.push({
          code: SkillValidationCodes.FRONTMATTER_MISSING_NAME,
          message: "SKILL.md frontmatter is missing 'name' field",
          location: skillMdPath,
        });
      }

      // Validate description
      const descResult = validateSkillDescription(parsed.frontmatter.description);
      errors.push(...descResult.errors.map((e) => ({ ...e, location: skillMdPath })));
      warnings.push(...descResult.warnings.map((w) => ({ ...w, location: skillMdPath })));
    }

    // Validate body
    const trimmedBody = body.trim();
    if (trimmedBody.length === 0) {
      errors.push({
        code: SkillValidationCodes.BODY_EMPTY,
        message: "SKILL.md body is empty. Add skill instructions after the frontmatter.",
        location: skillMdPath,
      });
    } else if (trimmedBody.length < 100) {
      warnings.push({
        code: SkillValidationCodes.BODY_TOO_SHORT,
        message: `SKILL.md body is very short (${trimmedBody.length} characters). Consider adding more detailed instructions.`,
        location: skillMdPath,
      });
    }
  } catch {
    errors.push({
      code: SkillValidationCodes.SKILL_MD_MISSING,
      message: "SKILL.md file not found",
      location: skillMdPath,
    });
  }

  return { errors, warnings, frontmatter, body };
}

/**
 * Check if a directory exists
 */
async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate skill directory structure
 */
export async function validateSkillStructure(skillPath: string): Promise<{
  errors: SkillValidationError[];
  warnings: SkillValidationWarning[];
  hasResources: { scripts: boolean; references: boolean; assets: boolean };
}> {
  const errors: SkillValidationError[] = [];
  const warnings: SkillValidationWarning[] = [];
  const hasResources = { scripts: false, references: false, assets: false };

  if (!(await directoryExists(skillPath))) {
    errors.push({
      code: SkillValidationCodes.SKILL_NOT_FOUND,
      message: `Skill directory not found: ${skillPath}`,
    });
    return { errors, warnings, hasResources };
  }

  // Check for resource directories
  for (const resource of ["scripts", "references", "assets"] as const) {
    const resourcePath = join(skillPath, resource);
    if (await directoryExists(resourcePath)) {
      hasResources[resource] = true;

      // Check if directory is empty
      try {
        const files = await readdir(resourcePath);
        if (files.length === 0) {
          warnings.push({
            code: SkillValidationCodes.EMPTY_RESOURCE_DIR,
            message: `${resource}/ directory is empty`,
            location: resourcePath,
          });
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // Check for extra files in root (not SKILL.md or resource directories)
  try {
    const entries = await readdir(skillPath, { withFileTypes: true });
    const allowedNames = ["SKILL.md", "scripts", "references", "assets"];

    for (const entry of entries) {
      if (!allowedNames.includes(entry.name)) {
        warnings.push({
          code: SkillValidationCodes.EXTRA_FILES_IN_ROOT,
          message: `Unexpected file/directory in skill root: ${entry.name}. Skills should only contain SKILL.md and resource directories.`,
          location: join(skillPath, entry.name),
        });
      }
    }
  } catch {
    // Ignore read errors
  }

  return { errors, warnings, hasResources };
}

/**
 * Full skill validation
 */
export async function validateSkill(skillPath: string): Promise<SkillValidationResult> {
  const allErrors: SkillValidationError[] = [];
  const allWarnings: SkillValidationWarning[] = [];
  let frontmatter = { name: "", description: "" };
  let body = "";
  let hasResources = { scripts: false, references: false, assets: false };

  // Validate directory structure
  const structResult = await validateSkillStructure(skillPath);
  allErrors.push(...structResult.errors);
  allWarnings.push(...structResult.warnings);
  hasResources = structResult.hasResources;

  // If directory exists, validate SKILL.md
  if (!allErrors.some((e) => e.code === SkillValidationCodes.SKILL_NOT_FOUND)) {
    const mdResult = await validateSkillMd(skillPath);
    allErrors.push(...mdResult.errors);
    allWarnings.push(...mdResult.warnings);
    frontmatter = mdResult.frontmatter;
    body = mdResult.body;

    // Validate name format if we have one
    if (frontmatter.name) {
      const nameErrors = validateSkillName(frontmatter.name);
      allErrors.push(...nameErrors);
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    info: {
      name: frontmatter.name,
      description: frontmatter.description,
      path: skillPath,
      hasResources,
      bodyLength: body.trim().length,
    },
  };
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: SkillValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push(`✅ Skill "${result.info.name}" is valid`);
  } else {
    lines.push(`❌ Skill "${result.info.name || "unknown"}" has ${result.errors.length} error(s)`);
  }

  if (result.errors.length > 0) {
    lines.push("\n🔴 Errors:");
    for (const error of result.errors) {
      lines.push(`  - [${error.code}] ${error.message}`);
      if (error.location) {
        lines.push(`    Location: ${error.location}`);
      }
    }
  }

  if (result.warnings.length > 0) {
    lines.push("\n🟡 Warnings:");
    for (const warning of result.warnings) {
      lines.push(`  - [${warning.code}] ${warning.message}`);
      if (warning.location) {
        lines.push(`    Location: ${warning.location}`);
      }
    }
  }

  lines.push("\n📊 Info:");
  lines.push(`  - Name: ${result.info.name || "(missing)"}`);
  lines.push(`  - Description: ${result.info.description.slice(0, 60)}${result.info.description.length > 60 ? "..." : ""}`);
  lines.push(`  - Body length: ${result.info.bodyLength} characters`);
  lines.push(`  - Resources: scripts=${result.info.hasResources.scripts}, references=${result.info.hasResources.references}, assets=${result.info.hasResources.assets}`);

  return lines.join("\n");
}
