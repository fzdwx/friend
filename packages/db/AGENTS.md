# DATABASE PACKAGE KNOWLEDGE BASE

**Package:** @friend/db
**Stack:** Prisma + SQLite
**Purpose:** Schema definitions and type-safe database access

---

## STRUCTURE

```
packages/db/
└── prisma/
    └── schema.prisma    # Database models and relationships (~50 lines)
```

---

## WHERE TO LOOK

| Task         | Location                    | Notes                          |
| ------------ | --------------------------- | ------------------------------ |
| Session 模型 | `schema.prisma` (Session)   | name, model, workingPath 字段  |
| 配置存储     | `schema.prisma` (AppConfig) | thinkingLevel 全局配置        |
| 自定义模型   | `schema.prisma` (CustomProvider, CustomModel) | OpenAI-compatible providers |

---

## CONVENTIONS

### 命名

- **PascalCase**: 模型名称 (`Session`, `CustomProvider`)
- **camelCase**: 字段名称 (`workingPath`, `contextWindow`)
- **可选字段**: 使用 `String?` 标记 nullable

### 关系定义

```prisma
model CustomModel {
  providerName   String
  provider       CustomProvider @relation(fields: [providerName], references: [name], onDelete: Cascade)

  @@unique([providerName, modelId])
}
```

### 数据库路径

```bash
# 生产环境使用绝对路径
DATABASE_URL="file:~/.config/friend/friend.db"
```

---

## MODELS

### Session

会话元数据存储（消息历史在 JSON 文件中）

```prisma
model Session {
  id          String    @id @default(uuid())
  name        String
  model       String?   # 当前使用的模型 ID
  workingPath String?   # 工作路径（可选）
  sessionFile String?   # 消息历史 JSON 文件路径
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

### AppConfig

全局应用配置（单例模式）

```prisma
model AppConfig {
  id            String @id @default("singleton")
  thinkingLevel String @default("medium")  # low/medium/high
}
```

### CustomProvider

自定义 OpenAI-compatible providers

```prisma
model CustomProvider {
  name    String        @id
  baseUrl String        # API base URL
  apiKey  String?
  api     String?       # API protocol
  headers String?       # JSON string of headers
  models  CustomModel[]
}
```

### CustomModel

自定义模型定义（成本、token 限制等）

```prisma
model CustomModel {
  id             String  @id @default(uuid())
  modelId        String  # 模型标识符
  name           String  # 显示名称
  reasoning      Boolean @default(false)  # 是否为推理模型
  contextWindow  Int     @default(128000)
  maxTokens      Int     @default(8192)
  costInput      Float   @default(0)
  costOutput     Float   @default(0)
  costCacheRead  Float   @default(0)
  costCacheWrite Float   @default(0)
  providerName   String
  provider       CustomProvider @relation(fields: [providerName], references: [name], onDelete: Cascade)

  @@unique([providerName, modelId])
}
```

---

## ANTI-PATTERNS

- **不要在生产环境使用相对路径数据库**: 使用绝对路径 `~/.config/friend/friend.db`
- **不要在 Session 中存储完整消息历史**: 使用 JSON 文件存储，Session 仅存元数据
- **不要修改默认 ID 生成**: 使用 `@default(uuid())` 确保唯一性
- **不要忽略删除级联**: 使用 `onDelete: Cascade` 维护引用完整性

---

## NOTES

- **混合存储策略**: Session 元数据在 SQLite，消息历史在 JSON 文件 (`~/.config/friend/sessions/*.json`)
- **单例配置**: AppConfig 使用固定 ID `"singleton"` 确保全局唯一
- **级联删除**: 删除 CustomProvider 会自动级联删除关联的 CustomModel
- **工作路径可选**: Session.workingPath 为可选字段，支持创建会话时不指定路径
