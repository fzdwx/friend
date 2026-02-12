# SERVER PACKAGE KNOWLEDGE BASE

**Package:** @friend/server  
**Stack:** Bun + Elysia.js  
**Port:** 3001

---

## STRUCTURE

```
src/
├── agent/manager.ts    # AI session orchestration
├── routes/
│   ├── sessions.ts     # CRUD + prompt/steer/abort
│   ├── models.ts       # AI model listing
│   ├── config.ts       # AppConfig
│   └── events.ts       # SSE streaming
└── index.ts
```

---

## WHERE TO LOOK

| Task         | Location                 |
| ------------ | ------------------------ |
| Agent 管理   | `src/agent/manager.ts`   |
| 自定义工具   | `src/agent/tools/`       |
| Session 路由 | `src/routes/sessions.ts` |
| SSE 流       | `src/routes/events.ts`   |

---

## CONVENTIONS

**Route**: `new Elysia({ prefix: "/api/sessions" }).post("/:id/prompt", handler, { body })`  
**Error handling**: `try { return { ok: true } } catch { return { ok: false, error: String(e) } }`  
**Fire-and-forget DB**: `prisma.session.update({...}).catch((err) => console.error("...", err))`

---

## ANTI-PATTERNS

- 不要阻塞响应等待 DB: 使用 fire-and-forget
- 不要在路由中处理业务逻辑: 委托给 AgentManager
- 不要使用相对路径数据库: `~/.config/friend/friend.db`

---

## SSE STREAMING

```typescript
.get("/api/sessions/:id/events", async function* ({ params }) {
  const subscriber = getAgentManager().subscribe(id);
  try {
    for await (const event of subscriber) {
      yield { event: event.type, data: JSON.stringify(event) };
    }
  } finally { subscriber.close(); }
});
```

Events: `agent_start/end`, `turn_start/end`, `text_delta`, `thinking_delta`, `tool_call_start/delta/end`, `tool_execution_start/update/end`, `error`, `session_updated`

---

## PATTERNS

### Working Path Selection

**Convention**: Optional workingPath in CreateSessionRequest, nullable in SQLite, returned in SessionInfo

```typescript
.post("/", async ({ body }) => {
  const session = await getAgentManager().createSession(body);
  return { ok: true, data: session };
}, { body: t.Object({ workingPath: t.Optional(t.String()) }) })
```
