# APP PACKAGE KNOWLEDGE BASE

**Package:** @friend/app  
**Stack:** React 19 + Vite 6 + Tailwind CSS v4 + Tauri v2  
**Purpose:** 桌面应用前端

---

## STRUCTURE

```
packages/app/src/
├── components/
│   ├── layout/         # ResizableLayout, Sidebar, ChatPanel, ActivityPanel
│   ├── chat/           # MessageList, InputArea, UserMessage, AssistantMessage
│   ├── config/         # ModelSelector, ThinkingLevelSelector, ApiKeySettings
│   └── tools/          # ToolExecution, BashOutput, FileChange, FileRead
├── hooks/              # useApi, useSSE, useSession, useSessions
├── stores/             # sessionStore, configStore, toolStore (Zustand)
├── lib/                # api.ts (API client), utils.ts (cn helper)
├── styles/             # globals.css (Tailwind v4 theme)
└── main.tsx            # React entry
```

---

## WHERE TO LOOK

| Task              | Location                            | Notes                      |
|-------------------|-------------------------------------|----------------------------|
| 根组件            | `src/App.tsx`                       | 布局组合 + SSEConnector    |
| 可拖拽布局        | `src/components/layout/ResizableLayout.tsx` | 三栏可拖拽布局       |
| API 调用          | `src/lib/api.ts`                    | 封装 fetch，统一错误处理   |
| SSE 连接          | `src/hooks/useSSE.ts`               | Server-Sent Events 订阅    |
| 状态管理          | `src/stores/*Store.ts`              | Zustand，selector 模式     |
| 样式变量          | `src/styles/globals.css`            | oklch 颜色系统             |

---

## CONVENTIONS

### 组件
```typescript
interface ComponentProps {
  propName: Type;
}

export function ComponentName({ propName }: ComponentProps) {
  // implementation
}
```

### Store 定义
```typescript
export const useStoreName = create<StoreState>((set, get) => ({
  // state
  // actions
}));
```

### API 调用
```typescript
const res = await api.someEndpoint();
if (res.ok && res.data) {
  // handle success
} else {
  // handle error
}
```

---

## ANTI-PATTERNS

- **不要在组件内直接 fetch**: 使用 `lib/api.ts` 中的封装方法
- **不要直接操作 DOM**: 使用 React ref 或 state
- **不要在 render 中创建对象**: 使用 `useMemo` 或提升到外部

---

## VITE CONFIG

```typescript
// vite.config.ts
{
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:3001" } }
  }
}
```

---

## TAURI CONFIG

- **Dev URL:** http://localhost:5173
- **Window:** 1280x800 (min: 900x600)
- **Dist:** ../dist
