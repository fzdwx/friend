# APP PACKAGE KNOWLEDGE BASE

**Package:** @friend/app  
**Stack:** React 19 + Vite 6 + Tailwind CSS v4 + Tauri v2

---

## STRUCTURE

```
src/
├── components/   # layout, chat, config, tools
├── hooks/        # useApi, useSSE, useSession
├── stores/       # sessionStore, configStore (Zustand)
├── lib/          # api.ts, theme.ts, themePresets.ts
└── main.tsx
```

---

## WHERE TO LOOK

| Task         | Location                              |
| ------------ | ------------------------------------- |
| 根组件       | `src/App.tsx`                         |
| API 调用     | `src/lib/api.ts`                      |
| SSE 连接     | `src/hooks/useSSE.ts`                 |
| 主题系统     | `src/lib/theme.ts` + `themePresets.ts` |
| 状态管理     | `src/stores/`                         |
| 配置 UI      | `src/components/config/`              |
| 工具渲染器   | `src/components/tools/registry/renderers/` |

---

## CONVENTIONS

```typescript
// Component
export function ComponentName({ propName }: ComponentProps) { }

// Store
export const useStoreName = create<StoreState>((set, get) => ({}));

// API
const res = await api.someEndpoint();
if (res.ok && res.data) { }
```

---

## ANTI-PATTERNS

- 不要在组件内直接 fetch: 使用 `lib/api.ts`
- 不要直接操作 DOM: 使用 React ref 或 state
- 不要在 render 中创建对象: 使用 `useMemo`

---

## CONFIG

**Vite**: Port 5173, proxy `/api` → `localhost:3001`  
**Tauri**: Dev URL `http://localhost:5173`, Window 1280x800

---

## PATTERNS

### Tool Renderer Registry (Depth 11)
**Location**: `src/components/tools/registry/renderers/`

**Pattern**: Self-registration via side-effect imports
```typescript
import { registerToolRenderer } from "./registry.js";
import { Icon } from "lucide-react";

registerToolRenderer("bash", {
  icon: <Icon className="w-3.5 h-3.5" />,
  getSummary: (args) => args.path || "...",
  ResultComponent: BashResult, // Optional
});
```
**Convention**: Side-effect imports only, icon `w-3.5 h-3.5`, truncation 2000-3000 chars, `ResultComponent` optional

详见: `src/components/tools/registry/renderers/AGENTS.md`
