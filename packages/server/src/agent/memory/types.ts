/**
 * Memory Search Types
 *
 * Based on OpenClaw's memory system design.
 */

// ─── Memory Sources ───────────────────────────────────────────

export type MemorySource = "memory" | "sessions";

// ─── Search Results ────────────────────────────────────────────

export interface MemorySearchResult {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  source: MemorySource;
  score: number;
  vectorScore?: number;
  textScore?: number;
}

// ─── Memory Chunk ──────────────────────────────────────────────

export interface MemoryChunk {
  id: string;
  path: string;
  source: MemorySource;
  startLine: number;
  endLine: number;
  text: string;
  hash: string;
  embedding?: number[];
}

// ─── Memory File Entry ─────────────────────────────────────────

export interface MemoryFileEntry {
  path: string;
  source: MemorySource;
  content: string;
  hash: string;
  size: number;
}

// ─── Embedding Provider ────────────────────────────────────────

export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

export interface EmbeddingProviderResult {
  provider: EmbeddingProvider;
  requestedProvider: "openai" | "gemini" | "voyage" | "auto";
  fallbackFrom?: "openai" | "gemini" | "voyage";
  fallbackReason?: string;
}

// ─── Memory Index Config ───────────────────────────────────────

export interface MemorySearchConfig {
  enabled: boolean;
  sources: MemorySource[];
  extraPaths: string[];
  provider: "openai" | "gemini" | "voyage" | "auto";
  model?: string;
  store: {
    path: string;
  };
  chunking: {
    tokens: number;
    overlap: number;
  };
  query: {
    maxResults: number;
    minScore: number;
    hybrid: {
      enabled: boolean;
      vectorWeight: number;
      textWeight: number;
      candidateMultiplier: number;
    };
  };
  sync: {
    onSessionStart: boolean;
    onSearch: boolean;
    watch: boolean;
    watchDebounceMs: number;
  };
  cache: {
    enabled: boolean;
    maxEntries?: number;
  };
}

// ─── Memory Index Status ───────────────────────────────────────

export interface MemoryIndexStatus {
  backend: "builtin";
  files: number;
  chunks: number;
  dirty: boolean;
  provider: string;
  model: string;
  requestedProvider: string;
  sources: MemorySource[];
  cache: {
    enabled: boolean;
    entries: number;
    maxEntries?: number;
  };
  vector: {
    enabled: boolean;
    available?: boolean;
    dims?: number;
    loadError?: string;
  };
}

// ─── Memory Sync Progress ──────────────────────────────────────

export interface MemorySyncProgressUpdate {
  completed: number;
  total: number;
  label?: string;
}

// ─── Constants ─────────────────────────────────────────────────

export const DEFAULT_CHUNK_TOKENS = 400;
export const DEFAULT_CHUNK_OVERLAP = 80;
export const DEFAULT_MAX_RESULTS = 10;
export const DEFAULT_MIN_SCORE = 0.35;
export const DEFAULT_HYBRID_VECTOR_WEIGHT = 0.7;
export const DEFAULT_HYBRID_TEXT_WEIGHT = 0.3;
export const DEFAULT_HYBRID_CANDIDATE_MULTIPLIER = 4;
export const DEFAULT_WATCH_DEBOUNCE_MS = 1500;
export const DEFAULT_MAX_SNIPPET_CHARS = 700;
