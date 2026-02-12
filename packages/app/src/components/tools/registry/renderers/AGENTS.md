# TOOL RENDERER REGISTRY

**Location:** `packages/app/src/components/tools/registry/renderers/`
**Purpose:** Self-registration pattern for Agent tool UI renderers

---

## STRUCTURE

```
renderers/
├── index.ts              # Barrel imports (side-effect only)
├── bash.ts               # Bash command renderer
├── read.ts               # File read renderer
└── ...                   # Other tool renderers
```

---

## WHERE TO LOOK

| Task               | File             |
| ------------------ | ---------------- |
| 工具渲染器注册中心 | `../registry.ts` |
| Bash 工具渲染      | `bash.ts`        |
| 文件读取渲染       | `read.ts`        |

---

## PATTERNS

### Self-Registration via Side-Effect Imports

```typescript
// Each renderer module:
import { registerToolRenderer } from "../registry.js";
import { Icon } from "lucide-react";

registerToolRenderer("bash", {
  icon: <Icon className="w-3.5 h-3.5" />,
  getSummary: (args) => args.path || "...",
  ResultComponent: BashResult,  // Optional
});

// index.ts - barrel imports all as side effects:
import "./bash.js";
import "./read.js";
```

**Convention**:

- Side-effect imports only (no exports from renderer files)
- Consistent icon sizing: `w-3.5 h-3.5`
- Truncation at 2000-3000 chars with `... (truncated)`
- `args.path || args.file_path || ""` pattern for flexible param names
- `ResultComponent` is optional (fallback to JSON view)

### Renderer Registration Signature

```typescript
interface ToolRendererConfig {
  icon: React.ReactNode;
  getSummary: (args: Record<string, any>) => string;
  ResultComponent?: React.ComponentType<{ args: any; result: any }>;
}
```

---

## CONVENTIONS

- **图标大小**: 统一使用 `w-3.5 h-3.5`
- **参数获取**: 优先级 `args.path > args.file_path > ""`
- **结果截断**: 超过 2000-3000 字符添加 `... (truncated)` 后缀
- **可选结果组件**: 未提供 `ResultComponent` 时使用默认 JSON 视图

---

## ANTI-PATTERNS

- 不要从 renderer 文件导出任何内容: 仅副作用注册
- 不要使用不同尺寸的图标: 统一 `w-3.5 h-3.5`
- 不要直接操作 DOM: 使用 React 组件

---

## NOTES

- **深度 11**: 位于 `src/components/tools/registry/renderers/`，是项目中嵌套最深的模块之一
- **自动注册**: 导入 `index.ts` 即可自动注册所有渲染器
- **扩展性**: 添加新工具渲染器只需创建文件并在 `index.ts` 中导入
