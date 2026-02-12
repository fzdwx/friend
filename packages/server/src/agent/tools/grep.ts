import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import path from "path";
import { stat } from "node:fs/promises";

// ─── Constants ───────────────────────────────────────────────

const MAX_LINE_LENGTH = 2000;
const MAX_RESULTS = 100;
const DEFAULT_WORKING_DIR = process.cwd();

// ─── Tool Parameters Schema ───────────────────────────────────

export const GrepParams = Type.Object({
  pattern: Type.String({ description: "The regex pattern to search for in file contents" }),
  path: Type.Optional(
    Type.String({
      description: "The directory to search in. Defaults to the current working directory.",
    }),
  ),
  include: Type.Optional(
    Type.String({
      description: 'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")',
    }),
  ),
});

// ─── Helper Types ────────────────────────────────────────────

interface GrepMatch {
  path: string;
  lineNum: number;
  lineText: string;
  modTime: number;
}

interface GrepResult {
  matches: number;
  truncated: boolean;
  output: string;
}

// ─── Tool Definition ─────────────────────────────────────────

export function createGrepTool(): ToolDefinition {
  return {
    name: "grep",
    label: "Grep",
    description:
      "Search file contents using regular expressions through the ripgrep engine. " +
      "Provides fast, parallelized content search with result limiting and error handling.",
    parameters: GrepParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const {
        pattern,
        path: searchPath = DEFAULT_WORKING_DIR,
        include,
      } = params as typeof GrepParams.static;

      // Validate pattern
      if (!pattern || pattern.trim().length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: pattern is required and cannot be empty",
            },
          ],
          details: undefined,
        };
      }

      try {
        // Resolve and validate search path
        const resolvedPath = await resolveSearchPath(searchPath);

        // Run ripgrep search
        const result = await runRipgrep({
          pattern,
          searchPath: resolvedPath,
          include,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: result.output,
            },
          ],
          details: undefined,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error during search: ${errorMessage}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}

// ─── Helper Functions ────────────────────────────────────────

async function resolveSearchPath(searchPath: string): Promise<string> {
  // Resolve relative paths
  let resolvedPath = path.isAbsolute(searchPath) ? searchPath : path.resolve(DEFAULT_WORKING_DIR, searchPath);

  // Check if path exists and is a directory
  try {
    const stats = await stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }
  } catch (err) {
    throw new Error(`Cannot access directory: ${resolvedPath} (${err instanceof Error ? err.message : String(err)})`);
  }

  return resolvedPath;
}

async function runRipgrep(options: {
  pattern: string;
  searchPath: string;
  include?: string;
}): Promise<GrepResult> {
  const { pattern, searchPath, include } = options;

  // Build ripgrep arguments
  const args = [
    "-nH", // Line numbers, filename with each match
    "--hidden", // Search hidden files
    "--no-messages", // Suppress error messages
    "--field-match-separator=|", // Custom separator for parsing
    "--regexp",
    pattern,
  ];

  // File include pattern
  if (include) {
    args.push("--glob", include);
  }

  // Add search path
  args.push(searchPath);

  // Run ripgrep using Bun.spawn
  const proc = Bun.spawn(["rg", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const errorOutput = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  // Handle exit codes
  // 0 = matches found, 1 = no matches, 2 = errors (but may still have matches)
  if (exitCode === 1 || (exitCode === 2 && !output.trim())) {
    return {
      matches: 0,
      truncated: false,
      output: `No matches found for pattern: "${pattern}"`,
    };
  }

  if (exitCode !== 0 && exitCode !== 2) {
    throw new Error(`ripgrep failed with exit code ${exitCode}: ${errorOutput}`);
  }

  const hasErrors = exitCode === 2;

  // Parse output and get file stats
  const lines = output.trim().split(/\r?\n/);
  const matches: GrepMatch[] = [];

  for (const line of lines) {
    if (!line) continue;

    const parts = line.split("|");
    if (parts.length < 3) continue;

    const [filePath, lineNumStr, ...lineTextParts] = parts;
    if (!filePath || !lineNumStr) continue;

    const lineNum = parseInt(lineNumStr, 10);
    const lineText = lineTextParts.join("|");

    // Truncate long lines at 2000 characters
    const truncatedLineText =
      lineText.length > MAX_LINE_LENGTH ? lineText.substring(0, MAX_LINE_LENGTH) + "..." : lineText;

    // Get file modification time
    let modTime = 0;
    try {
      const fileStats = await stat(filePath);
      modTime = fileStats.mtime.getTime();
    } catch {
      // Filter out inaccessible paths
      continue;
    }

    matches.push({
      path: filePath,
      lineNum,
      lineText: truncatedLineText,
      modTime,
    });
  }

  // Sort by modification time (most recently changed files first)
  matches.sort((a, b) => {
    if (b.modTime !== a.modTime) {
      return b.modTime - a.modTime;
    }
    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }
    return a.lineNum - b.lineNum;
  });

  // Limit to 100 matches with truncation notification
  const wasTruncated = matches.length > MAX_RESULTS;
  const displayMatches = wasTruncated ? matches.slice(0, MAX_RESULTS) : matches;

  if (displayMatches.length === 0) {
    return {
      matches: 0,
      truncated: false,
      output: `No matches found for pattern: "${pattern}"`,
    };
  }

  // Format output
  const outputLines = [`Found ${displayMatches.length} match${displayMatches.length === 1 ? "" : "es"}${wasTruncated ? ` (showing first ${MAX_RESULTS})` : ""}`];

  let currentFile = "";
  for (const match of displayMatches) {
    if (currentFile !== match.path) {
      if (currentFile !== "") {
        outputLines.push("");
      }
      currentFile = match.path;
      outputLines.push(`${match.path}:`);
    }
    outputLines.push(`  Line ${match.lineNum}: ${match.lineText}`);
  }

  if (wasTruncated) {
    outputLines.push("");
    outputLines.push(`(Results are truncated. Consider using a more specific pattern or path.)`);
  }

  if (hasErrors) {
    outputLines.push("");
    outputLines.push("(Some paths were inaccessible and were skipped)");
  }

  return {
    matches: displayMatches.length,
    truncated: wasTruncated,
    output: outputLines.join("\n"),
  };
}
