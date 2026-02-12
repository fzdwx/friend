import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import path from "path";
import { stat } from "node:fs/promises";

// ─── Constants ───────────────────────────────────────────────

const MAX_RESULTS = 100;
const DEFAULT_WORKING_DIR = process.cwd();

// ─── Tool Parameters Schema ───────────────────────────────────

export const GlobParams = Type.Object({
  pattern: Type.String({ description: "The glob pattern to match files against (e.g., '*.ts', 'src/**/*.js')" }),
  path: Type.Optional(
    Type.String({
      description: "The directory to search in. Defaults to the current working directory.",
    }),
  ),
  maxResults: Type.Optional(
    Type.Number({
      description: `Maximum number of results to return. Defaults to ${MAX_RESULTS}.`,
      minimum: 1,
      maximum: 1000,
    }),
  ),
});

// ─── Helper Types ────────────────────────────────────────────

interface GlobFile {
  path: string;
  mtime: number;
}

interface GlobResult {
  count: number;
  truncated: boolean;
  output: string;
}

// ─── Tool Definition ─────────────────────────────────────────

export function createGlobTool(): ToolDefinition {
  return {
    name: "glob",
    label: "Glob / Find Files",
    description:
      "Find files matching a glob pattern. " +
      "Supports wildcards like '*', '**', '?', and path separators. " +
      "Returns a list of matching file paths sorted by modification time (most recently changed first). " +
      "Useful for finding all files of a certain type or in a specific directory structure.",
    parameters: GlobParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const {
        pattern,
        path: searchPath = DEFAULT_WORKING_DIR,
        maxResults = MAX_RESULTS,
      } = params as typeof GlobParams.static;

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

        // Run glob search
        const result = await runGlob({
          pattern,
          searchPath: resolvedPath,
          maxResults,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: result.output,
            },
          ],
          details: {
            count: result.count,
            truncated: result.truncated,
            searchPath: resolvedPath,
            pattern,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error during file search: ${errorMessage}`,
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

async function runGlob(options: {
  pattern: string;
  searchPath: string;
  maxResults?: number;
}): Promise<GlobResult> {
  const { pattern, searchPath, maxResults = MAX_RESULTS } = options;

  // Build ripgrep arguments for glob search
  // We use ripgrep's --files flag combined with --glob to get matching files
  const args = [
    "--files", // Show only matching files
    "--hidden", // Search hidden files
    "--glob", pattern, // Glob pattern
    "--null", // Use null character as separator (handles filenames with spaces/newlines)
  ];

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
      count: 0,
      truncated: false,
      output: `No files found matching pattern: "${pattern}"`,
    };
  }

  if (exitCode !== 0 && exitCode !== 2) {
    throw new Error(`ripgrep failed with exit code ${exitCode}: ${errorOutput}`);
  }

  const hasErrors = exitCode === 2;

  // Parse output (null-separated paths)
  const nullSeparatedPaths = output.split("\0");
  const files: GlobFile[] = [];

  // Get file stats for sorting
  for (const relativePath of nullSeparatedPaths) {
    if (!relativePath || files.length >= maxResults) continue;

    const fullPath = path.resolve(searchPath, relativePath);

    // Get file modification time
    let mtime = 0;
    try {
      const fileStats = await stat(fullPath);
      mtime = fileStats.mtime.getTime();
    } catch {
      // If we can't stat the file, use current time
      mtime = Date.now();
    }

    files.push({
      path: fullPath,
      mtime,
    });
  }

  // Sort by modification time (most recently changed files first)
  files.sort((a, b) => {
    if (b.mtime !== a.mtime) {
      return b.mtime - a.mtime;
    }
    // If same modification time, sort by path alphabetically
    return a.path.localeCompare(b.path);
  });

  // Check if truncated
  const wasTruncated = files.length >= maxResults;
  const displayFiles = wasTruncated ? files.slice(0, maxResults) : files;

  if (displayFiles.length === 0) {
    return {
      count: 0,
      truncated: false,
      output: `No files found matching pattern: "${pattern}"`,
    };
  }

  // Format output
  const outputLines = [`Found ${displayFiles.length} file${displayFiles.length === 1 ? "" : "s"}${wasTruncated ? ` (showing first ${maxResults})` : ""}`];
  outputLines.push("");

  for (const file of displayFiles) {
    outputLines.push(file.path);
  }

  if (wasTruncated) {
    outputLines.push("");
    outputLines.push(`(Results are truncated. Found ${fileCountEstimate(displayFiles.length, maxResults)}+ total files. Consider using a more specific pattern or path.)`);
  }

  if (hasErrors) {
    outputLines.push("");
    outputLines.push("(Some paths were inaccessible and were skipped)");
  }

  return {
    count: displayFiles.length,
    truncated: wasTruncated,
    output: outputLines.join("\n"),
  };
}

// Estimate total files (rough heuristic based on truncation)
function fileCountEstimate(shownCount: number, limit: number): string {
  if (shownCount < limit) return shownCount.toString();
  return `>${limit}`;
}
