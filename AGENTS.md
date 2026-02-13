# PROJECT KNOWLEDGE BASE: Friend

**Generated:** 2026-02-14
**Commit:** 43fb779
**Branch:** main
**Tech Stack:** Bun + React + Tauri + Elysia + Prisma
**Type:** AI Coding Agent Desktop App (Monorepo)
**Stats:** 6293 files, 14577 TS lines, 4 packages

---

## OVERVIEW

Friend 是一个 AI 编程助手桌面应用，使用 Tauri + React 构建前端，Bun + Elysia 构建后端，通过 SSE 流式传输与 AI Agent 交互。

---

## STRUCTURE

```
.
├── packages/
│   ├── shared/     # 类型定义 (@friend/shared)
│   ├── server/     # Elysia API 后端 (@friend/server)
│   ├── app/        # React + Vite + Tauri 前端 (@friend/app)
│   └── db/         # Prisma + SQLite (@friend/db)
├── justfile        # 任务定义
└── package.json    # Bun workspaces
```

---

## WHERE TO LOOK

| Task                    | Location                          |
|-------------------------|-----------------------------------|
| 启动开发环境            | `just dev`                        |
| API 路由                | `packages/server/src/routes/`     |
| Agent 核心逻辑          | `packages/server/src/agent/`      |
| React 组件              | `packages/app/src/components/`    |
| 状态管理                | `packages/app/src/stores/`        |
| 共享类型                | `packages/shared/src/`            |
| 数据库 Schema           | `packages/db/prisma/schema.prisma`|

---

## CONVENTIONS

### 模块系统
- **ESM only** (`"type": "module"` in all packages)
- 本地导入使用 `.js` 扩展名: `import { x } from "./file.js"`
- Workspace 依赖: `@friend/shared`, `@friend/db`

### 命名
- **PascalCase**: 组件、类型、接口 (`Sidebar.tsx`, `SessionInfo`)
- **camelCase**: 函数、变量、hooks (`useSSE.ts`, `loadSessions`)
- **kebab-case**: 目录名 (`components/chat/`)

### 导入顺序
```typescript
// 1. 外部包
import { Elysia } from "elysia";
import { useEffect } from "react";

// 2. Workspace 包
import type { SessionInfo } from "@friend/shared";

// 3. 本地路径别名 (@/*)
import { useSessionStore } from "@/stores/sessionStore";
```

### API 响应格式
```typescript
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
```

---

## ANTI-PATTERNS

- **禁止使用 ESLint/Prettier**: 项目使用 `oxfmt` + `oxlint` 替代
- **不要在生产环境使用相对路径数据库**: 已固定到 `~/.config/friend/friend.db`
- **不要直接使用 `window.__TAURI__`**: 通过 API 客户端与后端通信
- **不要在组件外调用 hooks**: 遵循 React Rules of Hooks

---

## COMMANDS

```bash
just dev          # 启动所有服务
just dev-server   # 仅后端 (:3001)
just dev-app      # 仅前端 (:5173)
just dev-tauri    # 桌面应用
just fmt          # 格式化 (oxfmt)
just lint         # 检查 (oxlint)
just db-generate  # 生成 Prisma Client
just db-push      # 推送 schema
```

---

## NOTES

- **无测试框架**: 项目目前没有配置测试（仅有 ad-hoc test_tool.js 手动测试）
- **无 CI/CD**: 无 `.github/workflows` 目录
- **Tauri 图标**: `packages/app/src-tauri/icons/` 包含多平台图标
- **SSE 代理**: Vite dev server 代理 `/api` 到 `:3001`
- **主题系统**: 15 组内置主题（5 亮色 + 10 暗色），使用 oklch 颜色格式，支持自定义主题导入/导出。注意：`BUILT_IN_THEMES` 运行时数据在 `@friend/shared` 中，而非纯类型
- **数据库混合存储**: Session 元数据在 SQLite，消息历史在 JSON 文件 (`~/.config/friend/sessions/*.json`)
- **Tauri Dialog 插件**: 已配置 `dialog:default` 权限，前端通过 `@tauri-apps/plugin-dialog` 选择目录
- **自定义工具**: `packages/server/src/agent/tools/` 包含工厂函数模式创建 Agent 工具（14 个工具：theme/provider/session/memory 相关）
- **@friend/shared 运行时代码**: 虽然 AGENTS.md 声明纯类型定义，但 `themes.ts` 导出 `BUILT_IN_THEMES` 常量数组（469 行主题数据），被 server 和 app 共享
- **Memory 系统**: `packages/server/src/agent/memory/` 实现 Agent 长期记忆，支持 BM25 关键词搜索 + 向量语义搜索，使用 SQLite + sqlite-vec

---

## PATTERNS

### Tool Renderer Registry (Deep Module - Depth 11)
**Location**: `packages/app/src/components/tools/registry/renderers/`

**Pattern**: Self-registration via side-effect imports
```typescript
// Each renderer module:
import { registerToolRenderer } from "./registry.js";
import { Icon } from "lucide-react";

registerToolRenderer("bash", {
  icon: <Icon className="w-3.5 h-3.5" />,
  getSummary: (args) => args.path || "...",
  ResultComponent: BashResult,
});

// index.ts - barrel imports all as side effects:
import "./bash.js";
import "./read.js";
```

**Convention**:
- Side-effect imports only (no exports)
- Consistent icon sizing: `w-3.5 h-3.5`
- Truncation at 2000-3000 chars with `... (truncated)`
- `args.path || args.file_path || ""` pattern for flexible param names
