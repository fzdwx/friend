/**
 * Memory Flush - Pre-compaction memory save
 *
 * This module implements the "memory flush" mechanism that triggers
 * before session compaction, reminding the agent to save durable
 * memories to disk.
 *
 * Based on OpenClaw's implementation.
 */

// ─── Constants ───────────────────────────────────────────────

/**
 * Silent reply token - when the agent has nothing to store,
 * it should reply with this token to avoid visible output.
 */
export const SILENT_REPLY_TOKEN = "NO_REPLY";

/**
 * Default soft threshold for memory flush (in tokens).
 * Memory flush triggers when session is within this many tokens
 * of the compaction threshold.
 */
export const DEFAULT_MEMORY_FLUSH_SOFT_TOKENS = 4000;

/**
 * Default memory flush prompt
 */
export const DEFAULT_MEMORY_FLUSH_PROMPT = [
  "Pre-compaction memory flush.",
  "Store durable memories now (use memory/YYYY-MM-DD.md; create memory/ if needed).",
  "IMPORTANT: If the file already exists, APPEND new content only and do not overwrite existing entries.",
  `If nothing to store, reply with ${SILENT_REPLY_TOKEN}.`,
].join(" ");

/**
 * Default memory flush system prompt
 */
export const DEFAULT_MEMORY_FLUSH_SYSTEM_PROMPT = [
  "Pre-compaction memory flush turn.",
  "The session is near auto-compaction; capture durable memories to disk.",
  `You may reply, but usually ${SILENT_REPLY_TOKEN} is correct.`,
].join(" ");

// ─── Types ───────────────────────────────────────────────────

export interface MemoryFlushSettings {
  enabled: boolean;
  softThresholdTokens: number;
  prompt: string;
  systemPrompt: string;
}

// ─── Functions ───────────────────────────────────────────────

/**
 * Get default memory flush settings
 */
export function getDefaultMemoryFlushSettings(): MemoryFlushSettings {
  return {
    enabled: true,
    softThresholdTokens: DEFAULT_MEMORY_FLUSH_SOFT_TOKENS,
    prompt: DEFAULT_MEMORY_FLUSH_PROMPT,
    systemPrompt: DEFAULT_MEMORY_FLUSH_SYSTEM_PROMPT,
  };
}

/**
 * Check if memory flush should run based on token count
 *
 * @param totalTokens - Current session token count
 * @param contextWindow - Model's context window size
 * @param reserveTokensFloor - Tokens reserved for response (default: 20000)
 * @param softThreshold - Tokens before compaction to trigger flush
 * @returns Whether memory flush should run
 */
export function shouldRunMemoryFlush(params: {
  totalTokens: number;
  contextWindow: number;
  reserveTokensFloor?: number;
  softThreshold?: number;
}): boolean {
  const { totalTokens, contextWindow } = params;
  const reserveTokensFloor = params.reserveTokensFloor ?? 20000;
  const softThreshold = params.softThreshold ?? DEFAULT_MEMORY_FLUSH_SOFT_TOKENS;

  // Calculate threshold
  const threshold = contextWindow - reserveTokensFloor - softThreshold;

  // Check if we've crossed the threshold
  return totalTokens >= threshold;
}

/**
 * Build the memory flush message to inject
 */
export function buildMemoryFlushMessage(settings: MemoryFlushSettings): {
  userMessage: string;
  systemPrompt: string;
} {
  return {
    userMessage: ensureNoReplyHint(settings.prompt),
    systemPrompt: ensureNoReplyHint(settings.systemPrompt),
  };
}

/**
 * Ensure the prompt includes the NO_REPLY hint
 */
function ensureNoReplyHint(text: string): string {
  if (text.includes(SILENT_REPLY_TOKEN)) {
    return text;
  }
  return `${text}\n\nIf no user-visible reply is needed, start with ${SILENT_REPLY_TOKEN}.`;
}
