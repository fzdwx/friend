# MEMORY SYSTEM MODULE

**Location:** `packages/server/src/agent/memory/`
**Purpose:** Agent long-term memory with semantic search capabilities
**Lines:** ~1900

---

## STRUCTURE

```
memory/
├── index.ts        # Barrel exports
├── types.ts        # MemoryEntry, EmbeddingProvider, SearchMode
├── manager.ts      # MemoryIndexManager - core orchestration
├── embedding.ts    # OpenAI/Gemini/Voyage embedding providers
├── storage.ts      # SQLite + sqlite-vec vector storage
└── chunking.ts     # Markdown-aware chunking
```

---

## WHERE TO LOOK

| Task             | File           |
| ---------------- | -------------- |
| 记忆管理入口     | `manager.ts`   |
| 向量嵌入         | `embedding.ts` |
| 向量存储         | `storage.ts`   |
| 文本分块         | `chunking.ts`  |
| 类型定义         | `types.ts`     |

---

## ARCHITECTURE

### Memory Flow

```
Memory Files → Chunking → Embedding → SQLite + sqlite-vec
                                              ↓
Agent Query → Embedding → Vector Search → Ranked Results
```

### Embedding Providers

| Provider  | Model                    | Dimensions |
| --------- | ------------------------ | ---------- |
| OpenAI    | text-embedding-3-small   | 1536       |
| Gemini    | gemini-embedding-001     | 768        |
| Voyage    | voyage-4-large           | 1024       |

### Search Modes

| Mode     | Description                          | Config Required |
| -------- | ------------------------------------ | --------------- |
| BM25     | Keyword-based full-text search       | None            |
| Vector   | Semantic similarity search           | Embedding API   |
| Hybrid   | 70% vector + 30% BM25               | Embedding API   |

---

## PATTERNS

### Memory Index Manager

```typescript
const manager = new MemoryIndexManager(workspaceDir, {
  provider: "openai",
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY,
});

// Index all memory files
await manager.indexAll();

// Search memories
const results = await manager.search("OpenClaw memory design", {
  mode: "hybrid",
  maxResults: 10,
});
```

### Chunking Strategy

- **Markdown-aware**: Splits on headers (`#`, `##`, `###`)
- **Size limits**: Max 500 tokens per chunk
- **Overlap**: 50 tokens between chunks
- **Metadata**: Preserves source file and line numbers

---

## CONVENTIONS

- **Vector DB**: SQLite with sqlite-vec extension (bundled)
- **Chunk IDs**: `{filename}:{startLine}:{endLine}`
- **Score normalization**: 0-1 range for all search modes
- **Error handling**: Graceful fallback to BM25 if embedding fails

---

## ANTI-PATTERNS

- 不要跳过 chunking 直接存储: 必须通过 manager 接口
- 不要在内存中存储完整向量: 使用 SQLite 持久化
- 不要忽略 embedding 失败: 降级到 BM25 搜索

---

## NOTES

- **自动索引**: Memory flush 时自动更新索引
- **增量更新**: 仅处理变更的文件
- **清理**: 自动删除不存在的文件索引
