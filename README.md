# Friend

一个现代化的 AI 编程助手桌面应用，使用 Tauri + React 构建前端，Bun + Elysia 构建后端，通过 SSE 流式传输与 AI Agent 交互。

## ✨ 特性

- 🤖 **多模型支持** - 支持 OpenAI、Anthropic 等多种 AI 模型，可配置自定义 OpenAI-compatible 端点
- 💬 **流式对话** - 实时 SSE 流式传输，即时看到 AI 回复
- 🛠️ **工具调用** - 支持文件读写、Bash 命令执行等工具
- 🎯 **会话管理** - 创建、切换、删除会话，持久化聊天记录
- ⚙️ **灵活配置** - 支持自定义 Provider、API Key 管理、思维层级设置
- 🎨 **主题系统** - 15 组内置主题（5 亮色 + 10 暗色），支持自定义主题创建、编辑、导入/导出
- 🖥️ **桌面应用** - 基于 Tauri 的跨平台桌面应用（Windows/macOS/Linux）

## 🚀 快速开始

### 环境要求

- [Bun](https://bun.sh) 1.0+
- [Rust](https://rustup.rs/) (用于 Tauri 桌面应用)
- Node.js 18+ (可选，Bun 已内置)

### 安装

```bash
# 克隆仓库
git clone https://github.com/fzdwx/friend.git
cd friend

# 安装依赖
bun install

# 初始化数据库
just db-generate
just db-push
```

### 开发

```bash
# 启动开发服务器（同时启动后端和前端）
just dev

# 或者分别启动
just dev-server  # 后端: http://localhost:3001
just dev-app     # 前端: http://localhost:5173

# 启动桌面应用（需先启动 dev-server）
just dev-tauri
```

### 构建

```bash
# 构建前端
just build-app

# 构建桌面应用
just build-tauri
```

## 🏗️ 项目结构

```
.
├── packages/
│   ├── shared/     # 类型定义 (@friend/shared)
│   │   └── src/
│   │       ├── models.ts    # Session, Message, Model 类型
│   │       ├── api.ts       # API 请求/响应类型
│   │       └── events.ts    # SSE 事件类型
│   │
│   ├── server/     # Elysia API 后端 (@friend/server)
│   │   └── src/
│   │       ├── agent/
│   │       │   └── manager.ts    # AgentManager 核心
│   │       ├── routes/
│   │       │   ├── sessions.ts   # 会话 CRUD
│   │       │   ├── models.ts     # 模型列表
│   │       │   ├── config.ts     # 配置管理
│   │       │   └── events.ts     # SSE 流
│   │       └── index.ts
│   │
│   ├── app/        # React + Vite + Tauri 前端 (@friend/app)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── layout/       # Sidebar, ChatPanel, StatusBar
│   │       │   ├── chat/         # MessageList, InputArea
│   │       │   ├── config/       # ProviderSettings, AppearanceSettings
│   │       │   └── ModelSelector.tsx
│   │       ├── stores/           # Zustand 状态管理
│   │       ├── hooks/            # useSSE, useApi
│   │       ├── lib/
│   │       │   ├── api.ts        # API 客户端
│   │       │   ├── theme.ts      # 主题工具函数
│   │       │   └── themePresets.ts # 15 组内置配色
│   │       └── styles/
│   │           └── globals.css   # Tailwind v4 + oklch 颜色变量
│   │
│   └── db/         # Prisma + SQLite (@friend/db)
│       └── prisma/
│           └── schema.prisma     # 数据库模型定义
│
├── justfile        # 任务定义
└── package.json    # Bun workspaces
```

## 🛠️ 技术栈

### 后端
- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Elysia](https://elysiajs.com) - 高性能 TypeScript 框架
- **AI SDK**: [@mariozechner/pi-coding-agent](https://github.com/badlogic/pi-mono)
- **Database**: SQLite + [Prisma](https://prisma.io)
- **Stream**: Server-Sent Events (SSE)

### 前端
- **Framework**: React 19
- **Build Tool**: Vite 6
- **Desktop**: [Tauri v2](https://tauri.app)
- **Styling**: Tailwind CSS v4 + oklch 颜色格式
- **State**: [Zustand](https://github.com/pmndrs/zustand)
- **Icons**: [Lucide React](https://lucide.dev)
- **Color System**: oklch - 现代感知均匀颜色空间

### 代码质量
- **Formatter**: [oxfmt](https://github.com/oxc-project/oxc)
- **Linter**: [oxlint](https://github.com/oxc-project/oxc)
- **Type Check**: TypeScript 5.7

## 📋 可用命令

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
just db-migrate       # 创建 migration

# 构建
just build-app        # 构建前端
just build-tauri      # 构建桌面应用
just clean            # 清理构建产物
```

## ⚙️ 配置说明

### 模型配置

1. **内置模型** - 自动识别系统中已配置 API Key 的模型（OpenAI、Anthropic 等）

2. **自定义 Provider** - 点击顶部工具栏的 Server 图标添加：
   - 支持 OpenAI-compatible API
   - 可配置 API Key、Base URL
   - 支持多个模型定义

### API Key 配置

在启动应用前设置环境变量：

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

或在应用内通过自定义 Provider 配置。

### 主题配置

1. **内置主题** - 15 组预设主题：
   - **亮色主题**：Default Light, Gruvbox Light, Solarized Light, Catppuccin Latte, Rose Pine Dawn
   - **暗色主题**：Default Dark, Dracula, Nord, Gruvbox Dark, Monokai, Catppuccin Mocha, Solarized Dark, Tokyo Night, One Dark Pro, Rose Pine Moon

2. **自定义主题** - 点击顶部工具栏的 Server 图标，进入 Appearance 设置：
   - 基于现有主题创建自定义主题
   - 编辑 22 个语义化颜色变量
   - 实时预览主题效果
   - 导入/导出主题配置（JSON 格式）

3. **主题存储** - 自定义主题保存在浏览器的 localStorage 中

## 🔌 API 端点

### 会话管理
- `GET /api/sessions` - 列出所有会话
- `POST /api/sessions` - 创建会话
- `GET /api/sessions/:id` - 获取会话详情
- `DELETE /api/sessions/:id` - 删除会话
- `POST /api/sessions/:id/prompt` - 发送消息
- `POST /api/sessions/:id/model` - 设置模型

### 模型管理
- `GET /api/models` - 获取可用模型列表

### 配置管理
- `GET /api/config` - 获取配置
- `GET /api/config/providers` - 获取自定义 Providers
- `POST /api/config/providers` - 添加 Provider
- `DELETE /api/config/providers/:name` - 删除 Provider

### 事件流
- `GET /api/events` - SSE 全局事件流
- `GET /api/sessions/:id/events` - SSE 会话事件流

## 📝 开发指南

### 添加新功能

1. **共享类型** (`packages/shared/src/`)
   - 在 `models.ts` 添加领域类型
   - 在 `api.ts` 添加 API 类型

2. **后端** (`packages/server/src/`)
   - 在 `agent/manager.ts` 添加业务逻辑
   - 在 `routes/*.ts` 添加 HTTP 端点

3. **前端** (`packages/app/src/`)
   - 在 `lib/api.ts` 添加 API 客户端方法
   - 在 `stores/*.ts` 添加状态管理
   - 在 `components/` 添加 UI 组件

### 代码规范

- **ESM only** - 所有包使用 `"type": "module"`
- **文件扩展名** - 本地导入使用 `.js` 扩展名
- **命名规范**:
  - PascalCase: 组件、类型、接口
  - camelCase: 函数、变量、hooks
  - kebab-case: 目录名

### 主题系统开发

- **颜色格式**: 使用 oklch 而非 hex 或 rgb
  ```typescript
  const color: ColorDefinition = { l: 0.5, c: 0.1, h: 250 }; // 亮度、色度、色相
  ```
- **颜色变量**: 使用 CSS 变量，通过 `applyThemeToDOM()` 应用到 `:root`
- **颜色转换**: 使用 `hexToOklch()` 和 `oklchToHex()` 进行格式转换

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT

## 🙏 致谢

- [pi-mono](https://github.com/badlogic/pi-mono) - 底层 AI Agent SDK
- [Tauri](https://tauri.app) - 桌面应用框架
- [Elysia](https://elysiajs.com) - Web 框架
- [Bun](https://bun.sh) - JavaScript 运行时
