# SHARED PACKAGE KNOWLEDGE BASE

**Package:** @friend/shared  
**Purpose:** 类型定义与 API 契约  
**Usage:** Frontend + Backend 共享

---

## STRUCTURE

```
packages/shared/src/
├── models.ts       # Domain models (Session, Message, etc.)
├── api.ts          # API request/response types
├── events.ts       # SSE event types
└── index.ts        # Barrel exports
```

---

## WHERE TO LOOK

| Type          | File        | Key Exports                                              |
| ------------- | ----------- | -------------------------------------------------------- |
| Session types | `models.ts` | `SessionInfo`, `SessionDetail`                           |
| Message types | `models.ts` | `ChatMessage`, `UserChatMessage`, `AssistantChatMessage` |
| API types     | `api.ts`    | `ApiResponse<T>`, request/response types                 |
| SSE events    | `events.ts` | `SSEEvent`, `TextDeltaEvent`, `ToolCallStartEvent`       |

---

## CONVENTIONS

### 类型导出

```typescript
// index.ts
export * from "./models.js";
export * from "./api.js";
export * from "./events.js";
```

### Discriminated Unions

```typescript
export type ChatMessage = UserChatMessage | AssistantChatMessage | ToolResultChatMessage;

export interface UserChatMessage {
  role: "user";
  content: string;
  // ...
}
```

---

## ANTI-PATTERNS

- **不要在此包中添加运行时代码**: 纯类型定义
- **不要导入 node: 或 browser API**: 保持平台无关
- **不要使用枚举**: 使用字符串字面量联合类型

---

## USAGE

```typescript
// Frontend
import type { SessionInfo, ChatMessage } from "@friend/shared";

// Backend
import type { SessionInfo, ChatMessage } from "@friend/shared";
```
