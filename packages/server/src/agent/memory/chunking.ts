/**
 * Markdown Chunking for Memory Indexing
 *
 * Splits markdown content into overlapping chunks for embedding.
 */

import { createHash } from "node:crypto";
import type { MemoryChunk, MemoryFileEntry } from "./types.js";

// ─── Constants ───────────────────────────────────────────────

const DEFAULT_CHUNK_TOKENS = 400;
const DEFAULT_OVERLAP_TOKENS = 80;
const ESTIMATED_CHARS_PER_TOKEN = 4; // Rough estimate for English text

// ─── Token Estimation ─────────────────────────────────────────

/**
 * Simple token estimation (not exact, but fast)
 * For production, consider using tiktoken for exact counts
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English
  // Adjust for whitespace-heavy content
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;

  // Count words (roughly equivalent to tokens for English)
  const words = trimmed.split(/\s+/).length;
  const chars = trimmed.length;

  // Use the larger estimate
  return Math.max(words, Math.ceil(chars / ESTIMATED_CHARS_PER_TOKEN));
}

// ─── Chunking Algorithm ───────────────────────────────────────

/**
 * Chunk markdown content into overlapping sections
 *
 * Strategy:
 * 1. Split by headers (##, ###) to preserve semantic boundaries
 * 2. Further split large sections by paragraphs
 * 3. Add overlap between chunks for context continuity
 */
export function chunkMarkdown(
  content: string,
  options?: {
    maxTokens?: number;
    overlapTokens?: number;
  }
): Array<{
  text: string;
  startLine: number;
  endLine: number;
}> {
  const maxTokens = options?.maxTokens ?? DEFAULT_CHUNK_TOKENS;
  const overlapTokens = options?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const maxChars = maxTokens * ESTIMATED_CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * ESTIMATED_CHARS_PER_TOKEN;

  const lines = content.split("\n");
  const chunks: Array<{
    text: string;
    startLine: number;
    endLine: number;
  }> = [];

  let currentChunk: string[] = [];
  let currentStartLine = 1;
  let currentLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline

    // Check if this is a header (potential chunk boundary)
    const isHeader = /^#{1,3}\s+/.test(line);

    // If adding this line would exceed max size and we have content
    if (currentLength + lineLength > maxChars && currentChunk.length > 0) {
      // Save current chunk
      const chunkText = currentChunk.join("\n");
      if (chunkText.trim()) {
        chunks.push({
          text: chunkText,
          startLine: currentStartLine,
          endLine: i,
        });
      }

      // Start new chunk with overlap
      if (overlapChars > 0 && currentChunk.length > 0) {
        // Find overlap lines from the end of current chunk
        const overlapLines = getOverlapLines(currentChunk, overlapChars);
        currentChunk = overlapLines;
        currentStartLine = i - overlapLines.length + 1;
        currentLength = overlapLines.join("\n").length;
      } else {
        currentChunk = [];
        currentStartLine = i + 1;
        currentLength = 0;
      }

      // If line is a header and we just saved a chunk, start fresh
      if (isHeader) {
        currentChunk = [];
        currentStartLine = i + 1;
        currentLength = 0;
      }
    }

    currentChunk.push(line);
    currentLength += lineLength;
  }

  // Save final chunk
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join("\n");
    if (chunkText.trim()) {
      chunks.push({
        text: chunkText,
        startLine: currentStartLine,
        endLine: lines.length,
      });
    }
  }

  return chunks;
}

/**
 * Get overlap lines from the end of a chunk
 */
function getOverlapLines(lines: string[], maxChars: number): string[] {
  const result: string[] = [];
  let totalChars = 0;

  // Take lines from the end
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const lineLength = line.length + 1;

    if (totalChars + lineLength > maxChars) break;

    result.unshift(line);
    totalChars += lineLength;
  }

  return result;
}

// ─── Hash Generation ──────────────────────────────────────────

/**
 * Generate a hash for chunk content
 */
export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").substring(0, 16);
}

// ─── File Entry Building ──────────────────────────────────────

/**
 * Build memory chunks from a file entry
 */
export function buildChunksFromFile(
  entry: MemoryFileEntry,
  options?: {
    maxTokens?: number;
    overlapTokens?: number;
  }
): MemoryChunk[] {
  const rawChunks = chunkMarkdown(entry.content, options);

  return rawChunks.map((chunk, index) => {
    const chunkId = `${entry.path}:${chunk.startLine}-${chunk.endLine}`;
    return {
      id: chunkId,
      path: entry.path,
      source: entry.source,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      text: chunk.text,
      hash: hashText(chunk.text),
    };
  });
}

/**
 * Build a memory file entry from file content
 */
export async function buildFileEntry(
  filePath: string,
  workspaceDir: string,
  source: "memory" | "sessions" = "memory"
): Promise<MemoryFileEntry | null> {
  try {
    const fs = await import("node:fs/promises");
    const { join, relative } = await import("node:path");

    const absolutePath = join(workspaceDir, filePath);
    const content = await fs.readFile(absolutePath, "utf-8");
    const stat = await fs.stat(absolutePath);

    return {
      path: filePath,
      source,
      content,
      hash: hashText(content),
      size: stat.size,
    };
  } catch {
    return null;
  }
}
