/**
 * Memory Index Module
 *
 * Provides vector-based semantic search over MEMORY.md and memory/*.md files.
 */

// Types
export type {
  MemorySource,
  MemorySearchResult,
  MemoryChunk,
  MemoryFileEntry,
  EmbeddingProvider,
  EmbeddingProviderResult,
  MemorySearchConfig,
  MemoryIndexStatus,
  MemorySyncProgressUpdate,
} from "./types.js";

export {
  DEFAULT_CHUNK_TOKENS,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_MAX_RESULTS,
  DEFAULT_MIN_SCORE,
  DEFAULT_HYBRID_VECTOR_WEIGHT,
  DEFAULT_HYBRID_TEXT_WEIGHT,
  DEFAULT_HYBRID_CANDIDATE_MULTIPLIER,
  DEFAULT_WATCH_DEBOUNCE_MS,
  DEFAULT_MAX_SNIPPET_CHARS,
} from "./types.js";

// Embedding providers
export {
  OpenAIEmbeddingProvider,
  GeminiEmbeddingProvider,
  VoyageEmbeddingProvider,
  createEmbeddingProvider,
  type CreateEmbeddingProviderOptions,
} from "./embedding.js";

// Chunking
export {
  estimateTokens,
  chunkMarkdown,
  hashText,
  buildChunksFromFile,
  buildFileEntry,
} from "./chunking.js";

// Storage
export { MemoryStorage } from "./storage.js";

// Manager
export {
  MemoryIndexManager,
  getMemoryIndexManager,
  getDefaultConfig,
} from "./manager.js";
