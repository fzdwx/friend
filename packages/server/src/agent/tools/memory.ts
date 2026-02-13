/**
 * Memory Search and Get Tools
 *
 * Tools for searching and reading memory files (MEMORY.md, memory/*.md).
 * Uses vector-based semantic search when embedding API is available,
 * falls back to BM25 keyword search when no embedding provider is configured.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getMemoryIndexManager, type MemoryIndexManager } from "../memory/index.js";
import { DEFAULT_MAX_RESULTS, DEFAULT_MAX_SNIPPET_CHARS } from "../memory/types.js";

// ─── Tool Parameters Schemas ───────────────────────────────────

export const MemorySearchParams = Type.Object({
  query: Type.String({ description: "The search query to find relevant memories" }),
  maxResults: Type.Optional(
    Type.Number({ description: `Maximum number of results to return (default: ${DEFAULT_MAX_RESULTS})` })
  ),
});

export const MemoryGetParams = Type.Object({
  path: Type.String({ description: "Path to the memory file (relative to workspace)" }),
  from: Type.Optional(Type.Number({ description: "Starting line number (1-indexed)" })),
  lines: Type.Optional(Type.Number({ description: "Number of lines to read" })),
});

// ─── BM25-only Search (no embedding required) ────────────────────────────

/**
 * Simple BM25-style keyword search without embedding
 */
async function searchWithBM25(
  workspaceDir: string,
  query: string,
  maxResults: number
): Promise<Array<{
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score: number;
}>> {
  const { readdir, stat, readFile } = await import("node:fs/promises");
  const { join, basename } = await import("node:path");

  interface Chunk {
    path: string;
    startLine: number;
    endLine: number;
    text: string;
  }

  const chunks: Chunk[] = [];
  const memoryFiles: string[] = [];

  // Collect memory files
  try {
    const memoryPath = join(workspaceDir, "MEMORY.md");
    await stat(memoryPath);
    memoryFiles.push("MEMORY.md");
  } catch {}

  try {
    const memoryPath = join(workspaceDir, "memory.md");
    await stat(memoryPath);
    memoryFiles.push("memory.md");
  } catch {}

  const memoryDir = join(workspaceDir, "memory");
  try {
    const entries = await readdir(memoryDir, { withFileTypes: true });
    const mdFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => `memory/${e.name}`)
      .sort()
      .reverse();
    memoryFiles.push(...mdFiles);
  } catch {}

  // Read and chunk files
  for (const relPath of memoryFiles) {
    try {
      const content = await readFile(join(workspaceDir, relPath), "utf-8");
      const lines = content.split("\n");

      // Simple chunking: by paragraphs or every ~20 lines
      let chunkStart = 0;
      let currentChunk: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        currentChunk.push(lines[i]);

        // Chunk boundary: empty line or every 20 lines
        if (lines[i].trim() === "" || currentChunk.length >= 20) {
          if (currentChunk.some((l) => l.trim())) {
            chunks.push({
              path: relPath,
              startLine: chunkStart + 1,
              endLine: i + 1,
              text: currentChunk.join("\n"),
            });
          }
          chunkStart = i + 1;
          currentChunk = [];
        }
      }

      // Last chunk
      if (currentChunk.some((l) => l.trim())) {
        chunks.push({
          path: relPath,
          startLine: chunkStart + 1,
          endLine: lines.length,
          text: currentChunk.join("\n"),
        });
      }
    } catch {}
  }

  // Simple BM25-like scoring
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);

  const results: Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    snippet: string;
    score: number;
  }> = [];

  for (const chunk of chunks) {
    const textLower = chunk.text.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      // Count term frequency
      const matches = textLower.split(term).length - 1;
      if (matches > 0) {
        score += matches * 0.3;
      }
    }

    // Bonus for exact phrase match
    if (textLower.includes(query.toLowerCase())) {
      score += 2;
    }

    if (score > 0) {
      results.push({
        id: `${chunk.path}:${chunk.startLine}-${chunk.endLine}`,
        path: chunk.path,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        snippet: chunk.text.substring(0, 700),
        score,
      });
    }
  }

  // Sort by score and limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

// ─── Memory Search Tool Factory ────────────────────────────────

export function createMemorySearchTool(
  workspaceDir: string,
  options?: {
    agentId?: string;
    // Lazy getters for API keys (to support async auth storage)
    getOpenaiApiKey?: () => Promise<string | undefined>;
    getGeminiApiKey?: () => Promise<string | undefined>;
    getVoyageApiKey?: () => Promise<string | undefined>;
  }
): ToolDefinition {
  const agentId = options?.agentId ?? "default";

  return {
    name: "memory_search",
    label: "Memory Search",
    description:
      "Search MEMORY.md and memory/*.md files for relevant information. " +
      "Uses semantic search when embedding API is available, falls back to keyword search otherwise. " +
      "Use this before answering questions about prior work, decisions, dates, people, preferences, or todos. " +
      "Returns top snippets with file paths and line ranges.",
    parameters: MemorySearchParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { query, maxResults = DEFAULT_MAX_RESULTS } = params as typeof MemorySearchParams.static;

      if (!query || query.trim().length === 0) {
        return {
          content: [{ type: "text" as const, text: "Error: query is required" }],
          details: undefined,
        };
      }

      try {
        // Get API keys lazily
        const [openaiApiKey, geminiApiKey, voyageApiKey] = await Promise.all([
          options?.getOpenaiApiKey?.() ?? Promise.resolve(undefined),
          options?.getGeminiApiKey?.() ?? Promise.resolve(undefined),
          options?.getVoyageApiKey?.() ?? Promise.resolve(undefined),
        ]);

        const hasEmbeddingKey = openaiApiKey || geminiApiKey || voyageApiKey;

        let results: Array<{
          id: string;
          path: string;
          startLine: number;
          endLine: number;
          snippet: string;
          score: number;
        }>;

        // Try vector search if embedding key available
        if (hasEmbeddingKey) {
          try {
            const manager = await getMemoryIndexManager({
              workspaceDir,
              agentId,
              embeddingOptions: {
                openaiApiKey,
                geminiApiKey,
                voyageApiKey,
              },
            });
            results = await manager.search(query.trim(), { maxResults });
          } catch (err) {
            // Embedding failed, fall back to BM25
            console.warn("Vector search failed, falling back to BM25:", err);
            results = await searchWithBM25(workspaceDir, query.trim(), maxResults);
          }
        } else {
          // No embedding key, use BM25 directly
          results = await searchWithBM25(workspaceDir, query.trim(), maxResults);
        }

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No relevant memories found for: "${query}"`,
              },
            ],
            details: undefined,
          };
        }

        // Format results
        const output = formatSearchResults(results, !hasEmbeddingKey);

        return {
          content: [{ type: "text" as const, text: output }],
          details: { results },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error searching memories: ${errorMessage}` }],
          details: undefined,
        };
      }
    },
  };
}

// ─── Memory Get Tool Factory ────────────────────────────────────

export function createMemoryGetTool(
  workspaceDir: string,
  options?: {
    agentId?: string;
  }
): ToolDefinition {
  const agentId = options?.agentId ?? "default";

  return {
    name: "memory_get",
    label: "Memory Get",
    description:
      "Read a specific memory file with optional line range. " +
      "Use after memory_search to pull the full context of a snippet. " +
      "Only works on MEMORY.md and memory/*.md files.",
    parameters: MemoryGetParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { path: relPath, from, lines } = params as typeof MemoryGetParams;

      if (!relPath || relPath.trim().length === 0) {
        return {
          content: [{ type: "text" as const, text: "Error: path is required" }],
          details: undefined,
        };
      }

      try {
        // Get manager (for validation and reading)
        const manager = await getMemoryIndexManager({
          workspaceDir,
          agentId,
        }).catch(() => null);

        // If manager available, use its readFile method
        if (manager) {
          try {
            const result = await manager.readFile(relPath, { from, lines });
            return {
              content: [{ type: "text" as const, text: result.text }],
              details: { path: result.path, from, lines },
            };
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: "text" as const, text: `Error: ${errorMessage}` }],
              details: undefined,
            };
          }
        }

        // Fallback: direct file read
        const { readFile } = await import("node:fs/promises");
        const { join, basename } = await import("node:path");

        // Validate path
        const normalized = relPath.replace(/\\/g, "/");
        const name = basename(normalized);
        const isMemoryFile =
          name === "MEMORY.md" ||
          name === "memory.md" ||
          normalized.startsWith("memory/");

        if (!isMemoryFile) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Can only read MEMORY.md or memory/*.md files",
              },
            ],
            details: undefined,
          };
        }

        const absolutePath = join(workspaceDir, normalized);
        const content = await readFile(absolutePath, "utf-8");

        // Apply line range if specified
        if (from !== undefined || lines !== undefined) {
          const allLines = content.split("\n");
          const startLine = Math.max(1, from ?? 1);
          const lineCount = lines ?? allLines.length;
          const selectedLines = allLines.slice(startLine - 1, startLine - 1 + lineCount);

          return {
            content: [{ type: "text" as const, text: selectedLines.join("\n") }],
            details: { path: normalized, startLine, lineCount: selectedLines.length },
          };
        }

        return {
          content: [{ type: "text" as const, text: content }],
          details: { path: normalized },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if ((error as any)?.code === "ENOENT") {
          return {
            content: [{ type: "text" as const, text: `Memory file not found: ${relPath}` }],
            details: undefined,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Error reading memory: ${errorMessage}` }],
          details: undefined,
        };
      }
    },
  };
}

// ─── Helper Functions ────────────────────────────────────────

/**
 * Format search results for display
 */
function formatSearchResults(
  results: Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    snippet: string;
    score: number;
  }>,
  isBM25Only: boolean = false
): string {
  const lines: string[] = [
    `Found ${results.length} relevant memory snippet${results.length === 1 ? "" : "s"}` +
      (isBM25Only ? " (keyword search)" : "") + ":",
    "",
  ];

  for (const result of results) {
    const citation = `Source: ${result.path}#L${result.startLine}-L${result.endLine}`;
    lines.push(`### ${citation}`, "", result.snippet, "", "---", "");
  }

  lines.push(
    "Use `memory_get` to read the full context of any snippet.",
    `Example: memory_get(path="${results[0]?.path}", from=${results[0]?.startLine}, lines=20)`
  );

  return lines.join("\n");
}
