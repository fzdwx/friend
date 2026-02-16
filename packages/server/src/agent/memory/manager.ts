/**
 * Memory Index Manager
 *
 * Main class that coordinates embedding, storage, and search for memory files.
 * Based on OpenClaw's MemoryIndexManager design.
 */

import { readdir, stat, readFile } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { join, basename, dirname } from "node:path";
import { existsSync } from "node:fs";
import type {
  MemorySearchResult,
  MemorySearchConfig,
  MemoryChunk,
  MemoryFileEntry,
  MemorySource,
} from "./types.js";
import {
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
import type { EmbeddingProvider, EmbeddingProviderResult } from "./types.js";
import { createEmbeddingProvider } from "./embedding.js";
import { chunkMarkdown, hashText, buildChunksFromFile, estimateTokens } from "./chunking.js";
import { MemoryStorage } from "./storage.js";

// ─── Default Config ───────────────────────────────────────────

export function getDefaultConfig(workspaceDir: string, agentId: string): MemorySearchConfig {
  return {
    enabled: true,
    sources: ["memory"],
    extraPaths: [],
    provider: "auto",
    store: {
      path: join(workspaceDir, ".friend", "memory", `${agentId}.sqlite`),
    },
    chunking: {
      tokens: DEFAULT_CHUNK_TOKENS,
      overlap: DEFAULT_CHUNK_OVERLAP,
    },
    query: {
      maxResults: DEFAULT_MAX_RESULTS,
      minScore: DEFAULT_MIN_SCORE,
      hybrid: {
        enabled: true,
        vectorWeight: DEFAULT_HYBRID_VECTOR_WEIGHT,
        textWeight: DEFAULT_HYBRID_TEXT_WEIGHT,
        candidateMultiplier: DEFAULT_HYBRID_CANDIDATE_MULTIPLIER,
      },
    },
    sync: {
      onSessionStart: true,
      onSearch: true,
      watch: true,
      watchDebounceMs: DEFAULT_WATCH_DEBOUNCE_MS,
    },
    cache: {
      enabled: true,
      maxEntries: 50000,
    },
  };
}

// ─── Memory Index Manager ──────────────────────────────────────

export class MemoryIndexManager {
  private config: MemorySearchConfig;
  private storage: MemoryStorage;
  private embeddingProvider: EmbeddingProvider;
  private workspaceDir: string;
  private dirty = false;
  private watchers: FSWatcher[] = [];
  private watchTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  private constructor(options: {
    config: MemorySearchConfig;
    storage: MemoryStorage;
    embeddingProvider: EmbeddingProvider;
    workspaceDir: string;
  }) {
    this.config = options.config;
    this.storage = options.storage;
    this.embeddingProvider = options.embeddingProvider;
    this.workspaceDir = options.workspaceDir;
  }

  /**
   * Create a MemoryIndexManager instance
   */
  static async create(options: {
    workspaceDir: string;
    agentId: string;
    config?: Partial<MemorySearchConfig>;
    embeddingOptions?: {
      openaiApiKey?: string;
      geminiApiKey?: string;
      voyageApiKey?: string;
    };
  }): Promise<MemoryIndexManager> {
    const defaultConfig = getDefaultConfig(options.workspaceDir, options.agentId);
    const config: MemorySearchConfig = {
      ...defaultConfig,
      ...options.config,
      store: {
        ...defaultConfig.store,
        ...options.config?.store,
      },
      chunking: {
        ...defaultConfig.chunking,
        ...options.config?.chunking,
      },
      query: {
        ...defaultConfig.query,
        ...options.config?.query,
        hybrid: {
          ...defaultConfig.query.hybrid,
          ...options.config?.query?.hybrid,
        },
      },
    };

    if (!config.enabled) {
      throw new Error("Memory search is disabled");
    }

    // Create embedding provider
    const embeddingResult = createEmbeddingProvider({
      provider: config.provider,
      openaiApiKey: options.embeddingOptions?.openaiApiKey,
      geminiApiKey: options.embeddingOptions?.geminiApiKey,
      voyageApiKey: options.embeddingOptions?.voyageApiKey,
    });

    // Create storage
    const storage = new MemoryStorage(config.store.path);

    // Ensure vector table with correct dimensions
    const dims = embeddingResult.provider.getDimensions();
    storage.ensureVectorTable(dims);

    const manager = new MemoryIndexManager({
      config,
      storage,
      embeddingProvider: embeddingResult.provider,
      workspaceDir: options.workspaceDir,
    });

    // Mark as dirty to trigger initial sync
    manager.dirty = true;

    // Start file watcher if enabled
    if (config.sync.watch) {
      manager.startWatcher();
    }

    return manager;
  }

  // ─── File Watcher ────────────────────────────────────────────

  /**
   * Start watching memory files for changes
   */
  private startWatcher(): void {
    if (this.watchers.length > 0) return;

    const watchPaths: string[] = [];

    // Watch MEMORY.md
    const memoryPath = join(this.workspaceDir, "MEMORY.md");
    if (existsSync(memoryPath)) {
      watchPaths.push(memoryPath);
    }

    // Watch memory.md
    const memoryPathAlt = join(this.workspaceDir, "memory.md");
    if (existsSync(memoryPathAlt)) {
      watchPaths.push(memoryPathAlt);
    }

    // Watch memory/ directory
    const memoryDir = join(this.workspaceDir, "memory");
    if (existsSync(memoryDir)) {
      watchPaths.push(memoryDir);
    }

    const markDirty = () => {
      if (this.closed) return;
      this.dirty = true;
      this.scheduleWatchSync();
    };

    for (const watchPath of watchPaths) {
      try {
        const watcher = watch(watchPath, { persistent: false }, (eventType, filename) => {
          if (filename?.endsWith(".md") || eventType === "change") {
            markDirty();
          }
        });
        this.watchers.push(watcher);
      } catch (err) {
        // Ignore watch errors
        console.warn(`[MemoryIndex] Failed to watch ${watchPath}:`, err);
      }
    }
  }

  /**
   * Schedule a sync after file change (debounced)
   */
  private scheduleWatchSync(): void {
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
    }
    this.watchTimer = setTimeout(() => {
      this.watchTimer = null;
      this.sync().catch((err) => {
        console.warn("[MemoryIndex] Watch sync failed:", err);
      });
    }, this.config.sync.watchDebounceMs);
  }

  /**
   * Stop all file watchers
   */
  private stopWatcher(): void {
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
      this.watchTimer = null;
    }
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  // ─── Search ──────────────────────────────────────────────────

  /**
   * Search memory files
   */
  async search(
    query: string,
    options?: {
      maxResults?: number;
      minScore?: number;
    }
  ): Promise<MemorySearchResult[]> {
    const cleaned = query.trim();
    if (!cleaned) return [];

    const maxResults = options?.maxResults ?? this.config.query.maxResults;
    const minScore = options?.minScore ?? this.config.query.minScore;
    const hybrid = this.config.query.hybrid;

    // Sync if dirty
    if (this.dirty && this.config.sync.onSearch) {
      await this.sync();
    }

    // Get query embedding
    const queryEmbedding = await this.embeddingProvider.embed([cleaned]);
    const queryVec = queryEmbedding[0];

    // Check if vector is valid
    const hasVector = queryVec.some((v) => v !== 0);

    let vectorResults: Array<MemorySearchResult & { id: string; vectorScore: number }> = [];
    let keywordResults: Array<MemorySearchResult & { id: string; textScore: number }> = [];

    // Run vector search
    if (hasVector) {
      const candidates = Math.floor(maxResults * hybrid.candidateMultiplier);
      vectorResults = await this.storage.searchVector(queryVec, { limit: candidates });
    }

    // Run keyword search (if hybrid enabled)
    if (hybrid.enabled) {
      const candidates = Math.floor(maxResults * hybrid.candidateMultiplier);
      keywordResults = this.storage.searchKeyword(cleaned, { limit: candidates });
    }

    // Merge results
    let results: MemorySearchResult[];

    if (hybrid.enabled) {
      results = this.mergeHybridResults({
        vector: vectorResults,
        keyword: keywordResults,
        vectorWeight: hybrid.vectorWeight,
        textWeight: hybrid.textWeight,
      });
    } else {
      results = vectorResults.map((r) => ({
        id: r.id,
        path: r.path,
        source: r.source,
        startLine: r.startLine,
        endLine: r.endLine,
        snippet: r.snippet,
        score: r.vectorScore,
      }));
    }

    // Filter by min score and limit
    return results.filter((r) => r.score >= minScore).slice(0, maxResults);
  }

  /**
   * Merge vector and keyword search results
   */
  private mergeHybridResults(options: {
    vector: Array<MemorySearchResult & { id: string; vectorScore: number }>;
    keyword: Array<MemorySearchResult & { id: string; textScore: number }>;
    vectorWeight: number;
    textWeight: number;
  }): MemorySearchResult[] {
    const { vector, keyword, vectorWeight, textWeight } = options;

    // Union by id
    const byId = new Map<
      string,
      MemorySearchResult & { vectorScore?: number; textScore?: number }
    >();

    for (const v of vector) {
      byId.set(v.id, {
        id: v.id,
        path: v.path,
        source: v.source,
        startLine: v.startLine,
        endLine: v.endLine,
        snippet: v.snippet,
        score: 0,
        vectorScore: v.vectorScore,
      });
    }

    for (const k of keyword) {
      const existing = byId.get(k.id);
      if (existing) {
        existing.textScore = k.textScore;
      } else {
        byId.set(k.id, {
          id: k.id,
          path: k.path,
          source: k.source,
          startLine: k.startLine,
          endLine: k.endLine,
          snippet: k.snippet,
          score: 0,
          textScore: k.textScore,
        });
      }
    }

    // Compute final score
    const results: MemorySearchResult[] = [];
    for (const entry of byId.values()) {
      const vectorScore = entry.vectorScore ?? 0;
      const textScore = entry.textScore ?? 0;
      const score = vectorWeight * vectorScore + textWeight * textScore;

      results.push({
        id: entry.id,
        path: entry.path,
        source: entry.source,
        startLine: entry.startLine,
        endLine: entry.endLine,
        snippet: entry.snippet,
        score,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  // ─── Indexing ────────────────────────────────────────────────

  /**
   * Sync memory files to index
   */
  async sync(): Promise<void> {
    const files = await this.listMemoryFiles();
    const fileEntries: MemoryFileEntry[] = [];

    for (const file of files) {
      const entry = await this.buildFileEntry(file);
      if (entry) fileEntries.push(entry);
    }

    // Process each file
    for (const entry of fileEntries) {
      const existing = this.storage.getFile(entry.path);

      // Skip if unchanged
      if (existing?.hash === entry.hash) continue;

      // Chunk and embed
      await this.indexFile(entry);
    }

    // Clean up stale files (files that no longer exist on disk)
    const indexedPaths = this.storage.getAllFilePaths();
    const currentPaths = new Set(fileEntries.map((e) => e.path));

    for (const indexedPath of indexedPaths) {
      if (!currentPaths.has(indexedPath)) {
        console.log(`[MemoryIndex] Removing stale file: ${indexedPath}`);
        this.storage.deleteFile(indexedPath);
      }
    }

    this.dirty = false;
  }

  /**
   * Index a single file
   */
  private async indexFile(entry: MemoryFileEntry): Promise<void> {
    // Upsert file record
    this.storage.upsertFile(entry);

    // Build chunks
    const rawChunks = chunkMarkdown(entry.content, {
      maxTokens: this.config.chunking.tokens,
      overlapTokens: this.config.chunking.overlap,
    });

    const chunks: MemoryChunk[] = rawChunks.map((chunk, index) => ({
      id: `${entry.path}:${chunk.startLine}-${chunk.endLine}`,
      path: entry.path,
      source: entry.source,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      text: chunk.text,
      hash: hashText(chunk.text),
    }));

    // Process in batches for large files
    const BATCH_SIZE = 50; // Process 50 chunks at a time
    const batches: MemoryChunk[][] = [];
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      batches.push(chunks.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await this.indexChunkBatch(batch);
    }
  }

  /**
   * Index a batch of chunks
   */
  private async indexChunkBatch(chunks: MemoryChunk[]): Promise<void> {
    // Get embeddings (with caching)
    const embeddings: (number[] | null)[] = [];

    // Check cache for each chunk
    for (const chunk of chunks) {
      if (this.config.cache.enabled) {
        const cached = this.storage.getCachedEmbedding(chunk.hash);
        if (cached) {
          embeddings.push(cached);
          continue;
        }
      }
      embeddings.push(null);
    }

    // Embed uncached chunks
    const uncached: { index: number; chunk: MemoryChunk }[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (embeddings[i] === null) {
        uncached.push({ index: i, chunk: chunks[i] });
      }
    }

    if (uncached.length > 0) {
      try {
        const texts = uncached.map((u) => u.chunk.text);
        const newEmbeddings = await this.embeddingProvider.embed(texts);

        for (let i = 0; i < uncached.length; i++) {
          const { index, chunk } = uncached[i];
          embeddings[index] = newEmbeddings[i];

          // Cache the embedding
          if (this.config.cache.enabled && newEmbeddings[i]) {
            this.storage.cacheEmbedding(chunk.hash, newEmbeddings[i]);
          }
        }
      } catch (err) {
        console.warn(`[MemoryIndex] Failed to embed batch of ${uncached.length} chunks:`, err);
        // Continue without embeddings for failed chunks
      }
    }

    // Store chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i] ?? undefined;
      this.storage.upsertChunk(chunks[i]);
    }
  }

  /**
   * List all memory files
   */
  private async listMemoryFiles(): Promise<string[]> {
    const files: string[] = [];

    // Check MEMORY.md
    try {
      const memoryPath = join(this.workspaceDir, "MEMORY.md");
      await stat(memoryPath);
      files.push("MEMORY.md");
    } catch {}

    // Check memory.md (alternate)
    try {
      const memoryPath = join(this.workspaceDir, "memory.md");
      await stat(memoryPath);
      files.push("memory.md");
    } catch {}

    // Check memory/*.md
    const memoryDir = join(this.workspaceDir, "memory");
    try {
      const entries = await readdir(memoryDir, { withFileTypes: true });
      const mdFiles = entries
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => `memory/${e.name}`)
        .sort()
        .reverse(); // Most recent first

      files.push(...mdFiles);
    } catch {}

    return files;
  }

  /**
   * Build file entry from path
   */
  private async buildFileEntry(path: string): Promise<MemoryFileEntry | null> {
    try {
      const absolutePath = join(this.workspaceDir, path);
      const content = await readFile(absolutePath, "utf-8");
      const fileStat = await stat(absolutePath);

      return {
        path,
        source: "memory",
        content,
        hash: hashText(content),
        size: fileStat.size,
      };
    } catch {
      return null;
    }
  }

  // ─── File Reading ────────────────────────────────────────────

  /**
   * Read a memory file (for memory_get tool)
   */
  async readFile(
    relPath: string,
    options?: {
      from?: number;
      lines?: number;
    }
  ): Promise<{ text: string; path: string }> {
    // Validate path
    const normalized = relPath.replace(/\\/g, "/");
    if (!this.isMemoryPath(normalized)) {
      throw new Error("Invalid memory file path");
    }

    const absolutePath = join(this.workspaceDir, normalized);
    const content = await readFile(absolutePath, "utf-8");

    if (!options?.from && !options?.lines) {
      return { text: content, path: normalized };
    }

    const lines = content.split("\n");
    const start = Math.max(1, options?.from ?? 1);
    const count = options?.lines ?? lines.length;
    const slice = lines.slice(start - 1, start - 1 + count);

    return { text: slice.join("\n"), path: normalized };
  }

  /**
   * Check if path is a valid memory file
   */
  private isMemoryPath(path: string): boolean {
    const name = basename(path);
    return name === "MEMORY.md" || name === "memory.md" || path.startsWith("memory/");
  }

  // ─── Status ──────────────────────────────────────────────────

  /**
   * Get index status
   */
  status(): {
    files: number;
    chunks: number;
    dirty: boolean;
    provider: string;
    model: string;
    vectorAvailable: boolean;
    vectorReason: string;
  } {
    const stats = this.storage.getStats();
    const vectorStatus = this.storage.getVectorStatus();
    return {
      files: stats.files,
      chunks: stats.chunks,
      dirty: this.dirty,
      provider: this.embeddingProvider.id,
      model: this.embeddingProvider.model,
      vectorAvailable: vectorStatus.available,
      vectorReason: vectorStatus.reason,
    };
  }

  // ─── Cleanup ─────────────────────────────────────────────────

  /**
   * Close the manager and release resources
   */
  close(): void {
    this.closed = true;
    this.stopWatcher();
    this.storage.close();
  }
}

// ─── Singleton Cache ──────────────────────────────────────────

const managers = new Map<string, MemoryIndexManager>();

/**
 * Get or create a MemoryIndexManager for an agent
 */
export async function getMemoryIndexManager(options: {
  workspaceDir: string;
  agentId: string;
  config?: Partial<MemorySearchConfig>;
  embeddingOptions?: {
    openaiApiKey?: string;
    geminiApiKey?: string;
    voyageApiKey?: string;
  };
}): Promise<MemoryIndexManager> {
  const key = `${options.agentId}:${options.workspaceDir}`;

  if (managers.has(key)) {
    return managers.get(key)!;
  }

  const manager = await MemoryIndexManager.create(options);
  managers.set(key, manager);

  return manager;
}
