# STATE MANAGEMENT (ZUSTAND STORES)

**Location:** `packages/app/src/stores/`
**Purpose**: Global application state management

---

## STRUCTURE

```
stores/
├── sessionStore.ts   # Session and message state
├── configStore.ts    # Configuration state
└── ...
```

---

## WHERE TO LOOK

| Task         | File              |
| ------------ | ----------------- |
| 会话状态管理 | `sessionStore.ts` |
| 配置状态管理 | `configStore.ts`  |

---

## PATTERNS

### Zustand Store Pattern

```typescript
import { create } from "zustand";
import type { SessionInfo } from "@friend/shared";

interface SessionState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  setSessions: (sessions: SessionInfo[]) => void;
  setActiveSessionId: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
}));
```

**Convention**:

- Store name: `use{Domain}Store`
- State 接口: `{Domain}State`
- Actions: `set{Property}` 或具体动词 (`loadSessions`, `createSession`)

---

## CONVENTIONS

- **命名**: `use{Domain}Store` 格式
- **类型**: 导出 State 接口类型
- **导出**: 默认导出 store hook
- **更新**: 使用 `set()` 更新状态，`get()` 读取当前状态

---

## ANTI-PATTERNS

- 不要在 store 中直接调用 API: API 调用应在组件或 hooks 中
- 不要在 store 中使用副作用: 使用 `useEffect` 在组件中处理
- 不要在 store 中存储派生数据: 使用选择器或 useMemo 计算

---

## STORE RESPONSIBILITIES

| Store          | Purpose                       |
| -------------- | ----------------------------- |
| `sessionStore` | 会话列表、当前会话 ID、消息   |
| `configStore`  | 应用配置、主题、Provider 列表 |

---

## NOTES

- **3 文件**: 状态管理文件位于此目录
- **Zustand**: 使用 Zustand 作为状态管理库
- **同步更新**: SSE 事件通过 `sessionStore` 更新会话状态
