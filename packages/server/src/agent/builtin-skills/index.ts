/**
 * Builtin Skills Initialization
 *
 * Ensures built-in skills are created in the global skills directory
 * if they don't already exist.
 *
 * Each skill is a directory with SKILL.md and optional resources.
 * All files use .txt extension for bundling (Bun inlines them).
 *
 * At runtime, files are written with their actual names (without .txt).
 */

import { join, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { GLOBAL_SKILLS_DIR } from "../paths.js";

// Import skill content (inlined by Bun at build time)
import skillCreatorMd from "./skill-creator/SKILL.md.txt";
import agentBrowserMd from "./agent-browser/SKILL.md.txt";

// Import agent-browser references
import agentBrowserCommandsMd from "./agent-browser/references/commands.md.txt";
import agentBrowserSnapshotRefsMd from "./agent-browser/references/snapshot-refs.md.txt";
import agentBrowserSessionMgmtMd from "./agent-browser/references/session-management.md.txt";
import agentBrowserAuthMd from "./agent-browser/references/authentication.md.txt";
import agentBrowserVideoMd from "./agent-browser/references/video-recording.md.txt";
import agentBrowserProxyMd from "./agent-browser/references/proxy-support.md.txt";

// Import agent-browser templates
import agentBrowserFormAutomationSh from "./agent-browser/templates/form-automation.sh.txt";
import agentBrowserAuthSessionSh from "./agent-browser/templates/authenticated-session.sh.txt";
import agentBrowserCaptureWorkflowSh from "./agent-browser/templates/capture-workflow.sh.txt";

// Built-in skill definitions with their files
// Key = output filename, Value = content (imported from .txt files)
const BUILTIN_SKILLS: Record<string, Record<string, string>> = {
  "skill-creator": {
    "SKILL.md": skillCreatorMd,
  },
  "agent-browser": {
    "SKILL.md": agentBrowserMd,
    // References
    "references/commands.md": agentBrowserCommandsMd,
    "references/snapshot-refs.md": agentBrowserSnapshotRefsMd,
    "references/session-management.md": agentBrowserSessionMgmtMd,
    "references/authentication.md": agentBrowserAuthMd,
    "references/video-recording.md": agentBrowserVideoMd,
    "references/proxy-support.md": agentBrowserProxyMd,
    // Templates
    "templates/form-automation.sh": agentBrowserFormAutomationSh,
    "templates/authenticated-session.sh": agentBrowserAuthSessionSh,
    "templates/capture-workflow.sh": agentBrowserCaptureWorkflowSh,
  },
};

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
      // Write all files
      for (const [filePath, content] of Object.entries(files)) {
        const fullPath = join(skillDir, filePath);
        const parentDir = dirname(fullPath);

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
