/**
 * Context Compression - Check if compression is needed
 *
 * This module provides the logic to check when context compression
 * should be triggered. The actual compression is handled by
 * pi-coding-agent SDK's `session.compact(customInstructions)` API.
 */

// ─── Constants ───────────────────────────────────────────────

/**
 * Default threshold for context compression (as percentage).
 * Compression triggers when context usage exceeds this percentage.
 */
export const DEFAULT_COMPRESSION_THRESHOLD_PERCENT = 0.85; // 85%

/**
 * Minimum tokens to save before compression.
 * If we're this close to the limit, we must compress.
 */
export const MINIMUM_FREE_TOKENS = 15000;

// ─── Types ───────────────────────────────────────────────────

export interface CompressionCheckResult {
  needsCompression: boolean;
  currentTokens: number;
  contextWindow: number;
  percentUsed: number;
  freeTokens: number;
}

// ─── Functions ───────────────────────────────────────────────

/**
 * Check if context compression is needed
 *
 * @param currentTokens - Current token count
 * @param contextWindow - Model's context window
 * @param thresholdPercent - Optional custom threshold (default 0.85 = 85%)
 * @returns Whether compression is needed and details
 */
export function shouldCompressContext(
  currentTokens: number,
  contextWindow: number,
  thresholdPercent: number = DEFAULT_COMPRESSION_THRESHOLD_PERCENT
): CompressionCheckResult {
  const percentUsed = currentTokens / contextWindow;
  const freeTokens = contextWindow - currentTokens;

  // Check if compression is needed
  const overThreshold = percentUsed >= thresholdPercent;
  const tooCloseToLimit = freeTokens < MINIMUM_FREE_TOKENS;

  return {
    needsCompression: overThreshold || tooCloseToLimit,
    currentTokens,
    contextWindow,
    percentUsed,
    freeTokens,
  };
}
