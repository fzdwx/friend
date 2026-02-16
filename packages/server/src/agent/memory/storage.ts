/**
 * Memory Index Storage using SQLite
 *
 * Provides persistent storage for memory chunks and embeddings.
 * Uses Bun's built-in SQLite with optional sqlite-vec extension for vector similarity search.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { MemoryChunk, MemoryFileEntry, MemorySearchResult, MemorySource } from "./types.js";

// ─── Constants ───────────────────────────────────────────────

const VECTOR_TABLE = "chunks_vec";
const FTS_TABLE = "chunks_fts";
const CACHE_TABLE = "embedding_cache";

// ─── sqlite-vec Detection ─────────────────────────────────────

/**
 * Try to load sqlite-vec extension and check if it's available
 */
function detectVecExtension(db: Database): { available: boolean; reason: string } {
  // Common paths for sqlite-vec extension
  const extensionPaths = [
    "vec0",
    "./vec0.so",
    "./vec0.dylib",
    "./vec0.dll",
    "/usr/local/lib/vec0.so",
    "/usr/lib/vec0.so",
  ];

  // Try to load extension
  for (const path of extensionPaths) {
    try {
      db.loadExtension(path);
      return { available: true, reason: `Loaded from ${path}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If error is "no such function: sqlite3_load_extension", extensions are disabled
      if (msg.includes("not authorized") || msg.includes("not found")) {
        continue;
      }
    }
  }

  // Try to create a vec0 table directly (bundled extension)
  try {
    db.run(`
      CREATE TEMPORARY TABLE _vec_test USING vec0(
        id TEXT PRIMARY KEY,
        embedding FLOAT[4]
      )
    `);
    db.run("DROP TABLE _vec_test");
    return { available: true, reason: "Built-in sqlite-vec" };
  } catch {
    // sqlite-vec not available
  }

  return { available: false, reason: "sqlite-vec extension not found" };
}

// ─── Vector Utilities ─────────────────────────────────────────

function vectorToBlob(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

function blobToVector(blob: Buffer): number[] {
  const float32 = new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
  return Array.from(float32);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Memory Storage Class ─────────────────────────────────────

export class MemoryStorage {
  private db: Database;
  private dbPath: string;
  private vectorAvailable = false;
  private vectorUnavailableReason = "";
  private vectorDims: number | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    // Ensure directory exists
    const dir = dirname(dbPath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch {}

    this.db = new Database(dbPath);
    
    // Detect sqlite-vec extension
    const detection = detectVecExtension(this.db);
    this.vectorAvailable = detection.available;
    this.vectorUnavailableReason = detection.reason;
    
    if (this.vectorAvailable) {
      console.log(`[MemoryStorage] sqlite-vec available: ${detection.reason}`);
    } else {
      console.log(`[MemoryStorage] sqlite-vec not available: ${detection.reason}, using fallback`);
    }
    
    this.ensureSchema();
  }

  // ─── Schema Management ─────────────────────────────────────

  private ensureSchema(): void {
    // Meta table for storing config
    this.db.run(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // Files table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Chunks table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        source TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        text TEXT NOT NULL,
        hash TEXT NOT NULL,
        embedding BLOB,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (path) REFERENCES files(path)
      )
    `);

    // Create index for faster lookups
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source)`);

    // Embedding cache table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS ${CACHE_TABLE} (
        hash TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        dims INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Try to create FTS table (for keyword search)
    try {
      this.db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(
          id,
          text,
          path,
          source,
          content=''
        )
      `);
    } catch {
      // FTS not available, will use LIKE-based search
    }
  }

  // ─── Vector Table Management ────────────────────────────────

  ensureVectorTable(dimensions: number): void {
    if (this.vectorDims === dimensions) return;

    // Try to create sqlite-vec virtual table
    try {
      // Drop existing table if dimensions changed
      if (this.vectorDims !== null && this.vectorDims !== dimensions) {
        this.db.run(`DROP TABLE IF EXISTS ${VECTOR_TABLE}`);
      }

      this.db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ${VECTOR_TABLE} USING vec0(
          id TEXT PRIMARY KEY,
          embedding FLOAT[${dimensions}]
        )
      `);
      this.vectorDims = dimensions;
      this.vectorAvailable = true;
    } catch {
      // sqlite-vec not available, will use in-memory cosine similarity
      this.vectorAvailable = false;
    }
  }

  isVectorAvailable(): boolean {
    return this.vectorAvailable;
  }

  getVectorStatus(): { available: boolean; reason: string } {
    return {
      available: this.vectorAvailable,
      reason: this.vectorAvailable ? "sqlite-vec extension loaded" : this.vectorUnavailableReason,
    };
  }

  // ─── Meta Management ────────────────────────────────────────

  getMeta(key: string): string | null {
    const stmt = this.db.query<{ value: string }, [string]>("SELECT value FROM meta WHERE key = ?");
    const row = stmt.get(key);
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db.run(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value]
    );
  }

  // ─── File Management ─────────────────────────────────────────

  upsertFile(entry: MemoryFileEntry): void {
    this.db.run(
      `INSERT INTO files (path, source, hash, size, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         hash = excluded.hash,
         size = excluded.size,
         updated_at = excluded.updated_at`,
      [entry.path, entry.source, entry.hash, entry.size, Date.now()]
    );
  }

  getFile(path: string): { hash: string } | null {
    const stmt = this.db.query<{ hash: string }, [string]>("SELECT hash FROM files WHERE path = ?");
    return stmt.get(path) ?? null;
  }

  deleteFile(path: string): void {
    this.db.run("DELETE FROM files WHERE path = ?", [path]);
    this.db.run("DELETE FROM chunks WHERE path = ?", [path]);
    try {
      this.db.run(`DELETE FROM ${VECTOR_TABLE} WHERE id IN (SELECT id FROM chunks WHERE path = ?)`, [path]);
    } catch {}
    try {
      this.db.run(`DELETE FROM ${FTS_TABLE} WHERE path = ?`, [path]);
    } catch {}
  }

  /**
   * Get all indexed file paths
   * Used for cleanup of stale files
   */
  getAllFilePaths(): string[] {
    const stmt = this.db.query<{ path: string }, []>("SELECT path FROM files");
    const rows = stmt.all();
    return rows.map((row) => row.path);
  }

  // ─── Chunk Management ────────────────────────────────────────

  upsertChunk(chunk: MemoryChunk): void {
    const embeddingBlob = chunk.embedding ? vectorToBlob(chunk.embedding) : null;

    this.db.run(
      `INSERT INTO chunks (id, path, source, start_line, end_line, text, hash, embedding, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         start_line = excluded.start_line,
         end_line = excluded.end_line,
         text = excluded.text,
         hash = excluded.hash,
         embedding = excluded.embedding,
         updated_at = excluded.updated_at`,
      [
        chunk.id,
        chunk.path,
        chunk.source,
        chunk.startLine,
        chunk.endLine,
        chunk.text,
        chunk.hash,
        embeddingBlob,
        Date.now(),
      ]
    );

    // Also add to FTS table if available
    try {
      this.db.run(
        `INSERT INTO ${FTS_TABLE} (id, text, path, source)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET text = excluded.text`,
        [chunk.id, chunk.text, chunk.path, chunk.source]
      );
    } catch {}
  }

  upsertChunks(chunks: MemoryChunk[]): void {
    const tx = this.db.transaction(() => {
      for (const chunk of chunks) {
        this.upsertChunk(chunk);
      }
    });
    tx();
  }

  getChunk(id: string): MemoryChunk | null {
    const stmt = this.db.query<any, [string]>("SELECT * FROM chunks WHERE id = ?");
    const row = stmt.get(id);
    if (!row) return null;

    return {
      id: row.id,
      path: row.path,
      source: row.source,
      startLine: row.start_line,
      endLine: row.end_line,
      text: row.text,
      hash: row.hash,
      embedding: row.embedding ? blobToVector(row.embedding as Buffer) : undefined,
    };
  }

  getChunksByPath(path: string): MemoryChunk[] {
    const stmt = this.db.query<any, [string]>("SELECT * FROM chunks WHERE path = ?");
    const rows = stmt.all(path);

    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      source: row.source,
      startLine: row.start_line,
      endLine: row.end_line,
      text: row.text,
      hash: row.hash,
      embedding: row.embedding ? blobToVector(row.embedding as Buffer) : undefined,
    }));
  }

  // ─── Embedding Cache ─────────────────────────────────────────

  getCachedEmbedding(hash: string): number[] | null {
    const stmt = this.db.query<{ embedding: Buffer }, [string]>(
      `SELECT embedding FROM ${CACHE_TABLE} WHERE hash = ?`
    );
    const row = stmt.get(hash);
    return row ? blobToVector(row.embedding) : null;
  }

  cacheEmbedding(hash: string, embedding: number[]): void {
    this.db.run(
      `INSERT INTO ${CACHE_TABLE} (hash, embedding, dims, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(hash) DO UPDATE SET
         embedding = excluded.embedding,
         dims = excluded.dims,
         updated_at = excluded.updated_at`,
      [hash, vectorToBlob(embedding), embedding.length, Date.now()]
    );
  }

  // ─── Vector Search ───────────────────────────────────────────

  async searchVector(
    queryEmbedding: number[],
    options?: {
      limit?: number;
      sources?: MemorySource[];
    }
  ): Promise<Array<MemorySearchResult & { id: string; vectorScore: number }>> {
    const limit = options?.limit ?? 10;

    // If sqlite-vec is available, use it
    if (this.vectorAvailable && this.vectorDims === queryEmbedding.length) {
      try {
        const stmt = this.db.query<any, [Buffer, number]>(`
          SELECT
            c.id, c.path, c.source, c.start_line, c.end_line, c.text,
            v.distance
          FROM ${VECTOR_TABLE} v
          JOIN chunks c ON v.id = c.id
          WHERE v.embedding MATCH ?
          ORDER BY v.distance ASC
          LIMIT ?
        `);

        const rows = stmt.all(vectorToBlob(queryEmbedding), limit);

        return rows.map((row) => ({
          id: row.id,
          path: row.path,
          source: row.source,
          startLine: row.start_line,
          endLine: row.end_line,
          snippet: row.text.substring(0, 700),
          score: 1 / (1 + row.distance),
          vectorScore: 1 / (1 + row.distance),
        }));
      } catch {
        // Fall through to in-memory search
      }
    }

    // Fallback: in-memory cosine similarity
    const stmt = this.db.query<any, []>("SELECT * FROM chunks WHERE embedding IS NOT NULL");
    const rows = stmt.all();

    const results: Array<MemorySearchResult & { id: string; vectorScore: number }> = [];

    for (const row of rows) {
      const embedding = blobToVector(row.embedding as Buffer);
      const score = cosineSimilarity(queryEmbedding, embedding);

      results.push({
        id: row.id,
        path: row.path,
        source: row.source,
        startLine: row.start_line,
        endLine: row.end_line,
        snippet: row.text.substring(0, 700),
        score,
        vectorScore: score,
      });
    }

    // Sort by score and limit
    results.sort((a, b) => b.vectorScore - a.vectorScore);
    return results.slice(0, limit);
  }

  // ─── Keyword Search (FTS) ────────────────────────────────────

  searchKeyword(
    query: string,
    options?: {
      limit?: number;
      sources?: MemorySource[];
    }
  ): Array<MemorySearchResult & { id: string; textScore: number }> {
    const limit = options?.limit ?? 10;

    try {
      // Try FTS search
      const stmt = this.db.query<any, [string, number]>(`
        SELECT
          c.id, c.path, c.source, c.start_line, c.end_line, c.text,
          f.rank
        FROM ${FTS_TABLE} f
        JOIN chunks c ON f.id = c.id
        WHERE ${FTS_TABLE} MATCH ?
        ORDER BY f.rank ASC
        LIMIT ?
      `);

      const rows = stmt.all(query, limit);

      return rows.map((row) => ({
        id: row.id,
        path: row.path,
        source: row.source,
        startLine: row.start_line,
        endLine: row.end_line,
        snippet: row.text.substring(0, 700),
        score: 1 / (1 + Math.max(0, row.rank)),
        textScore: 1 / (1 + Math.max(0, row.rank)),
      }));
    } catch {
      // Fallback: LIKE-based search
      const stmt = this.db.query<any, [string, number]>(`
        SELECT id, path, source, start_line, end_line, text
        FROM chunks
        WHERE text LIKE ?
        LIMIT ?
      `);

      const rows = stmt.all(`%${query}%`, limit);

      return rows.map((row) => ({
        id: row.id,
        path: row.path,
        source: row.source,
        startLine: row.start_line,
        endLine: row.end_line,
        snippet: row.text.substring(0, 700),
        score: 0.5, // Base score for LIKE match
        textScore: 0.5,
      }));
    }
  }

  // ─── Stats ───────────────────────────────────────────────────

  getStats(): { files: number; chunks: number } {
    const files = this.db.query<{ c: number }, []>("SELECT COUNT(*) as c FROM files").get();
    const chunks = this.db.query<{ c: number }, []>("SELECT COUNT(*) as c FROM chunks").get();

    return {
      files: files?.c ?? 0,
      chunks: chunks?.c ?? 0,
    };
  }

  // ─── Cleanup ─────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
