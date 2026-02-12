# DATABASE PACKAGE KNOWLEDGE BASE

**Package:** @friend/db
**Stack:** Prisma + SQLite

---

## STRUCTURE

```
prisma/
└── schema.prisma
```

---

## WHERE TO LOOK

| Task         | Location        |
| ------------ | --------------- |
| Session 模型 | `schema.prisma` |
| 配置存储     | `schema.prisma` |
| 自定义模型   | `schema.prisma` |

---

## CONVENTIONS

**命名**: PascalCase 模型, camelCase 字段, `String?` nullable  
**数据库路径**: `file:~/.config/friend/friend.db`

---

## MODELS

**Session**: id, name, model?, workingPath?, sessionFile?, createdAt, updatedAt  
**AppConfig**: id="singleton", thinkingLevel  
**CustomProvider**: name, baseUrl, apiKey?, api?, headers?, models[]  
**CustomModel**: id, modelId, name, reasoning, contextWindow, maxTokens, costInput, costOutput, providerName, provider

---

## ANTI-PATTERNS

- 不要使用相对路径数据库
- 不要在 Session 中存储完整消息历史: 使用 JSON 文件
- 不要忽略删除级联: `onDelete: Cascade`

---

## NOTES

- **混合存储**: Session 元数据在 SQLite，消息历史在 JSON 文件
- **单例配置**: AppConfig 使用固定 ID `"singleton"`
