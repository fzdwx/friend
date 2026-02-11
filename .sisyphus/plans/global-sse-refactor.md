# 全局 SSE 架构改进方案

## 当前问题

1. **每会话一个 SSE 连接**: `/api/sessions/:id/events`
2. **切换会话需重连**: 切换 active session 时关闭旧连接、建立新连接
3. **连接管理复杂**: 多个 session 同时活跃时难以管理

## 改进目标

**单连接多路复用**: 全局一个 SSE 连接 (`/api/events`)，所有会话事件通过该连接传输

## 架构设计

### 事件格式扩展

```typescript
// 所有事件增加 sessionId 字段
interface SSEEvent {
  type: string;
  sessionId: string;  // 新增：标识事件归属的会话
  // ... 其他字段
}

// 示例事件
{
  "type": "text_delta",
  "sessionId": "f3937136-8fc0-4c72-afe1-bf27d9ff85cf",
  "content": "Hello"
}
```

### 后端架构

```
┌─────────────────────────────────────────────────────────┐
│                    AgentManager                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              全局 Event Bus                      │    │
│  │  Map<sessionId, EventEmitter>                   │    │
│  └─────────────────────────────────────────────────┘    │
│           ↑                              ↑              │
│     subscribe(id)                 subscribe(id)         │
│           │                              │              │
│  ┌────────┴────────┐            ┌────────┴────────┐     │
│  │   Session A     │            │   Session B     │     │
│  │  subscribers    │            │  subscribers    │     │
│  └─────────────────┘            └─────────────────┘     │
└─────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  /api/events    │  ← 全局 SSE 端点
                    │  合并所有事件流  │
                    └─────────────────┘
```

### 前端架构

```
┌─────────────────────────────────────────────────────┐
│                   useGlobalSSE                       │
│  ┌───────────────────────────────────────────────┐  │
│  │         EventSource (单连接)                   │  │
│  │         /api/events                           │  │
│  └───────────────────────────────────────────────┘  │
│                      │                              │
│          ┌──────────┼──────────┐                    │
│          ↓          ↓          ↓                    │
│    ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│    │Session A│ │Session B│ │Session C│             │
│    │ Store   │ │ Store   │ │ Store   │             │
│    └─────────┘ └─────────┘ └─────────┘             │
│                                                     │
│  路由逻辑: if (event.sessionId === activeSessionId) │
└─────────────────────────────────────────────────────┘
```

## 实施步骤

### Phase 1: 后端改造

1. **修改 Event 类型** (packages/shared/src/events.ts)
   - 所有事件接口添加 `sessionId` 字段

2. **创建全局 Event Bus** (packages/server/src/agent/eventBus.ts)
   - 管理所有会话的事件订阅
   - 提供全局事件流合并功能

3. **修改 AgentManager** (packages/server/src/agent/manager.ts)
   - 广播事件时包含 sessionId
   - 提供全局订阅方法

4. **创建新路由** (packages/server/src/routes/events.ts)
   - 新的 `/api/events` 端点
   - 合并所有活跃会话的事件流

### Phase 2: 前端改造

1. **创建 useGlobalSSE hook** (packages/app/src/hooks/useGlobalSSE.ts)
   - 单 EventSource 连接
   - 根据 sessionId 路由事件

2. **修改 sessionStore** (packages/app/src/stores/sessionStore.ts)
   - 支持多会话状态管理
   - 按 sessionId 存储 streaming 状态

3. **删除旧 useSSE hook**
   - 移除每会话连接逻辑

4. **更新 App.tsx**
   - 使用新的 useGlobalSSE

### Phase 3: 测试验证

1. 多会话同时活跃测试
2. 会话切换测试
3. 断线重连测试
4. 性能测试

## 关键代码示例

### 后端：全局事件流

```typescript
// packages/server/src/routes/events.ts
export const eventRoutes = new Elysia().get(
  "/api/events",
  async function* () {
    // 创建全局订阅器
    const subscriber = getAgentManager().subscribeGlobal();
    
    try {
      for await (const event of subscriber) {
        // 所有事件自动包含 sessionId
        yield { 
          event: event.type, 
          data: JSON.stringify(event) 
        };
      }
    } finally {
      subscriber.close();
    }
  },
);
```

### 前端：全局 SSE Hook

```typescript
// packages/app/src/hooks/useGlobalSSE.ts
export function useGlobalSSE() {
  useEffect(() => {
    const es = new EventSource('/api/events');
    
    const handleEvent = (e: MessageEvent) => {
      const event: SSEEvent = JSON.parse(e.data);
      const { sessionId, type } = event;
      
      // 路由到对应会话的 store
      const store = getSessionStore(sessionId);
      store.handleEvent(event);
    };
    
    // 监听所有事件类型
    es.addEventListener('message', handleEvent);
    
    return () => es.close();
  }, []);
}
```

### Store 改造

```typescript
// 按 sessionId 存储状态
interface GlobalSessionState {
  sessions: Map<string, SessionState>;
  activeSessionId: string | null;
  
  handleEvent: (event: SSEEvent) => void;
  getSessionStore: (id: string) => SessionState;
}
```

## 收益

1. **连接数减少**: 从 N 个连接降为 1 个
2. **切换流畅**: 切换会话无需重连
3. **支持后台会话**: 非活跃会话也能接收更新
4. **简化代码**: 无需管理多个 EventSource

## 风险

1. **事件量增大**: 所有会话事件都通过一个连接传输
2. **前端路由复杂**: 需要按 sessionId 路由事件
3. **兼容性**: 需要确保现有功能不受影响
