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

### Session (元数据存储)
```prisma
model Session {
  id          String    @id @default(uuid())
  name        String
  model       String?
  workingPath String?
  sessionFile String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

### AppConfig (单例配置)
```prisma
model AppConfig {
  id            String @id @default("singleton")
  thinkingLevel String @default("medium")
}
```

### CustomProvider
```prisma
model CustomProvider {
  name    String        @id
  baseUrl String
  apiKey  String?
  api     String?
  headers String?
  models  CustomModel[]
}
```

### CustomModel
```prisma
model CustomModel {
  id             String  @id @default(uuid())
  modelId        String
  name           String
  reasoning      Boolean @default(false)
  contextWindow  Int     @default(128000)
  maxTokens      Int     @default(8192)
  costInput      Float   @default(0)
  costOutput     Float   @default(0)
  providerName   String
  provider       CustomProvider @relation(fields: [providerName], references: [name], onDelete: Cascade)
  @@unique([providerName, modelId])
}
```

---

## ANTI-PATTERNS

- 不要使用相对路径数据库
- 不要在 Session 中存储完整消息历史: 使用 JSON 文件
- 不要忽略删除级联: `onDelete: Cascade`

---

## NOTES

- **混合存储**: Session 元数据在 SQLite，消息历史在 JSON 文件
- **单例配置**: AppConfig 使用固定 ID `"singleton"`
