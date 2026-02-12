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

| Type          | File        | Key Exports                                  |
| ------------- | ----------- | -------------------------------------------- |
| Session types | `models.ts` | `SessionInfo`, `SessionDetail`, `workingPath?` |
| Message types | `models.ts` | `ChatMessage` (SDK re-exports)              |
| API types     | `api.ts`    | `ApiResponse<T>`, request/response types     |
| SSE events    | `events.ts` | `SSEEvent`, `ErrorEvent` (SDK + app-specific) |

---

## PATTERNS

### SDK Re-Export Pattern
```typescript
// models.ts
export type { Message, UserMessage, AssistantMessage } from "@mariozechner/pi-ai";

// events.ts
export type { AgentSessionEvent, ... } from "@mariozechner/pi-coding-agent";
```
**Convention**: Named re-exports only, SDK types imported as-is

### Extension Pattern
```typescript
export interface SessionDetail extends SessionInfo {
  messages: Message[];  // Adds message list to SessionInfo
}
```
**Convention**: Extension pattern over redefinition, single source of truth

---

## CONVENTIONS

```typescript
// Barrel exports (index.ts)
export * from "./models.js";
export * from "./api.js";
export * from "./events.js";

// Discriminated unions
export type ChatMessage = UserChatMessage | AssistantChatMessage | ToolResultChatMessage;
```

---

## ANTI-PATTERNS

- **不要在此包中添加运行时代码**: 纯类型定义
- **不要导入 node: 或 browser API**: 保持平台无关
- **不要使用枚举**: 使用字符串字面量联合类型

---

## USAGE

```typescript
import type { SessionInfo, ChatMessage } from "@friend/shared";
```
