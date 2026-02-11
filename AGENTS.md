# PROJECT KNOWLEDGE BASE: Friend

**Generated:** 2026-02-11  
**Tech Stack:** Bun + React + Tauri + Elysia + Prisma  
**Type:** AI Coding Agent Desktop App (Monorepo)

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

| Task                    | Location                          | Notes                          |
|-------------------------|-----------------------------------|--------------------------------|
| 启动开发环境            | `just dev`                        | 同时启动 server + frontend     |
| API 路由                | `packages/server/src/routes/`     | Elysia 路由模块                |
| Agent 核心逻辑          | `packages/server/src/agent/`      | SessionManager 编排 AI 调用    |
| React 组件              | `packages/app/src/components/`    | 按功能分: chat/layout/config   |
| 状态管理                | `packages/app/src/stores/`        | Zustand stores                 |
| 共享类型                | `packages/shared/src/`            | models/api/events              |
| 数据库 Schema           | `packages/db/prisma/schema.prisma`| SQLite + Prisma                |
| API 客户端              | `packages/app/src/lib/api.ts`     | 封装 fetch，返回统一格式       |

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
# 开发
just dev              # 启动所有服务
just dev-server       # 仅后端 (:3001)
just dev-app          # 仅前端 (:5173)
just dev-tauri        # 桌面应用

# 代码质量
just fmt              # 格式化 (oxfmt)
just lint             # 检查 (oxlint)
just fix              # 自动修复
just typecheck        # TypeScript 检查

# 数据库
just db-generate      # 生成 Prisma Client
just db-push          # 推送 schema
just db-studio        # Prisma Studio
```

---

## NOTES

- **无测试框架**: 项目目前没有配置测试
- **无 CI/CD**: 无 `.github/workflows` 目录
- **Tauri 图标**: `packages/app/src-tauri/icons/` 包含多平台图标
- **SSE 代理**: Vite dev server 代理 `/api` 到 `:3001`
- **Dark-First**: UI 使用 oklch 暗色主题，无亮色模式
