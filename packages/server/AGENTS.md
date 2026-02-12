# SERVER PACKAGE KNOWLEDGE BASE

**Package:** @friend/server  
**Stack:** Bun + Elysia.js  
**Port:** 3001  
**Purpose:** REST API + SSE streaming backend

---

## STRUCTURE

```
packages/server/src/
├── agent/
│   └── manager.ts          # AgentManager: AI session orchestration (~834 lines)
├── routes/
│   ├── sessions.ts         # CRUD + prompt/steer/abort
│   ├── models.ts           # AI model listing
│   ├── config.ts           # AppConfig endpoints
│   └── events.ts           # SSE event streaming
└── index.ts                # Elysia app bootstrap
```

---

## WHERE TO LOOK

| Task         | Location                       | Notes                               |
| ------------ | ------------------------------ | ----------------------------------- |
| 应用入口     | `src/index.ts`                 | Elysia 实例 + 路由组合              |
| Agent 管理   | `src/agent/manager.ts`         | SessionManager 包装 pi-coding-agent |
| Session 路由 | `src/routes/sessions.ts`       | POST /:id/prompt, /:id/steer        |
| SSE 流       | `src/routes/events.ts`         | async generator 实现                |
| 数据库映射   | `manager.ts` 中的 dbToDomain() | Prisma ↔ Domain 类型转换            |

---

## CONVENTIONS

### 路由定义

```typescript
export const routes = new Elysia({ prefix: "/api/sessions" }).post(
  "/:id/prompt",
  async ({ params, body }) => {
    // handler
  },
  { body: t.Object({ message: t.String() }) },
);
```

### 错误处理

```typescript
try {
  await operation();
  return { ok: true };
} catch (e) {
  return { ok: false, error: String(e) };
}
```

### Fire-and-Forget DB 操作

```typescript
// 注释标记非阻塞操作
prisma.session.update({...}).catch((err) =>
  console.error("...", err)
);
```

---

## ANTI-PATTERNS

- **不要阻塞响应等待 DB**: 使用 fire-and-forget 模式
- **不要在路由中处理业务逻辑**: 委托给 AgentManager
- **不要使用相对路径数据库**: 使用绝对路径 `~/.config/friend/friend.db`

---

## SSE STREAMING

```typescript
.get("/api/sessions/:id/events", async function* ({ params }) {
  const subscriber = getAgentManager().subscribe(id);
  try {
    for await (const event of subscriber) {
      yield { event: event.type, data: JSON.stringify(event) };
    }
  } finally {
    subscriber.close();
  }
});
```

---

## EVENT TYPES

- `agent_start/end` - Agent 会话生命周期
- `turn_start/end` - 单次对话轮次
- `text_delta` - 流式文本片段
- `thinking_delta` - 思考过程
- `tool_call_start/delta/end` - 工具调用
- `tool_execution_start/update/end` - 工具执行
- `error` - 错误事件
- `session_updated` - 会话状态更新

---

## PATTERNS

### Working Path Selection (Recent Feature)

**Location**: `src/routes/sessions.ts`, `src/agent/manager.ts`

**Pattern**: Optional working path in session creation with database persistence

```typescript
// Route handler with optional workingPath
.post(
  "/",
  async ({ body }) => {
    const session = await getAgentManager().createSession(body);
    return { ok: true, data: session };
  },
  { body: t.Object({ name: t.Optional(t.String()), workingPath: t.Optional(t.String()) }) },
)

// Manager stores working path in Prisma
const session = await prisma.session.create({
  data: {
    name,
    model: undefined,
    workingPath: params.workingPath || null, // Optional field
    sessionFile: null,
  },
});
```

**Convention**:
- `workingPath` is optional in CreateSessionRequest
- Stored as nullable string in SQLite (String?)
- Returned in SessionInfo via GET /api/sessions
- Client-side handles both Tauri (native dialog) and browser (file input) selection
