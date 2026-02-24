# Apex

一个现代化的 AI 编程助手桌面应用，提供流畅的对话体验和强大的工具调用能力。

**基于 Tauri + React 构建跨平台桌面应用，Bun + Elysia 构建高性能后端**

> 🔄 **测试 file-tracker v2** - 2026-02-19 22:09

<div align="center">

![Static Badge](https://img.shields.io/badge/Bun-1.0+-black?logo=bun)
![Static Badge](https://img.shields.io/badge/React-19-blue?logo=react)
![Static Badge](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)
![Static Badge](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

## ✨ 特性

### 🤖 AI 能力

- **多模型支持** - 原生支持 OpenAI、Anthropic，可配置任意 OpenAI-compatible 端点
- **流式对话** - 基于 SSE 的实时流式传输，零延迟看到 AI 思考和回复
- **思维链可视化** - 独立 Activity 面板展示 AI 思考过程和工具调用
- **会话管理** - 创建、切换、删除会话，自动持久化聊天记录
- **Memory 系统** - Agent 拥有长期记忆和每日日志，支持语义搜索
- **文件追踪** - 自动追踪并显示 Session 中修改的文件，支持持久化
- **自定义工具** - 扩展 AI 能力，提供 15 个内置工具

### 🎨 主题系统

- **15 组内置主题** - 5 组亮色 + 10 组暗色精心设计的配色方案
- **oklch 颜色空间** - 现代感知均匀颜色，色彩转换更自然
- **AI 生成主题** - 基于色相和饱和度自动生成和谐配色
- **实时预览** - 主题切换即时生效，所见即所得
- **导入/导出** - JSON 格式主题配置，方便分享

### 🛠️ 工具调用

内置 15 个 Agent 工具：

| 类别         | 工具                     | 功能                    |
| ------------ | ------------------------ | ----------------------- |
| **文件**     | `grep`                   | 搜索文件内容（ripgrep） |
|              | `glob`                   | 按模式查找文件          |
| **会话**     | `create_session`         | 创建新会话              |
|              | `get_session`            | 获取会话详情            |
|              | `rename_session`         | 重命名会话              |
| **记忆**     | `memory_search`          | 语义搜索 Agent 记忆     |
|              | `memory_get`             | 读取记忆文件片段        |
| **主题**     | `get_themes`             | 查询可用主题            |
|              | `generate_theme`         | AI 生成自定义主题       |
|              | `set_theme`              | 切换主题                |
| **Provider** | `add_custom_provider`    | 添加 AI 模型提供商      |
|              | `list_custom_providers`  | 列出已配置提供商        |
|              | `update_custom_provider` | 更新提供商配置          |

### 🖥️ 桌面应用

- **跨平台** - Windows、macOS、Linux 原生应用
- **独立窗口** - 1280x800 默认窗口，可自定义
- **系统集成** - 原生菜单、通知、文件访问

## 🚀 快速开始

### 环境要求

- [Bun](https://bun.sh) 1.0+
- [Rust](https://rustup.rs/) （用于 Tauri 桌面应用）
- Node.js 18+ （可选，Bun 已内置）

### 安装

```bash
# 克隆仓库
git clone https://gitlab.minum.cloud/innovationteam/apex.git
cd apex

# 安装依赖
bun install

# 初始化数据库
just db-generate
just db-push
```

### 开发

```bash
# 启动所有服务（后端 + 前端）
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
│   ├── shared/              # 类型定义和共享代码
│   │   └── src/
│   │       ├── models.ts    # Session, Message, Model 类型
│   │       ├── api.ts       # API 请求/响应类型
│   │       ├── events.ts    # SSE 事件类型
│   │       └── themes.ts    # 15 组内置主题配置
│   │
│   ├── server/              # Elysia API 后端
│   │   └── src/
│   │       ├── agent/
│   │       │   ├── manager.ts         # AgentManager 核心
│   │       │   ├── memory-flush.ts    # 记忆自动保存 ⭐
│   │       │   ├── file-tracker.ts    # Session 文件追踪 ⭐
│   │       │   ├── extensions/        # Agent 扩展
│   │       │   │   ├── plan-mode.ts   # 计划模式
│   │       │   │   └── file-tracker.ts # 文件追踪扩展
│   │       │   ├── memory/            # Memory 系统 ⭐
│   │       │   │   ├── manager.ts     # MemoryIndexManager
│   │       │   │   ├── embedding.ts   # OpenAI/Gemini/Voyage
│   │       │   │   ├── storage.ts     # SQLite + sqlite-vec
│   │       │   │   ├── chunking.ts    # Markdown 分块
│   │       │   │   └── types.ts
│   │       │   └── tools/             # 自定义工具（15 个）⭐
│   │       │       ├── index.ts
│   │       │       ├── memory.ts       # memory_search, memory_get
│   │       │       ├── grep.ts         # 文件内容搜索
│   │       │       ├── glob.ts         # 文件模式匹配
│   │       │       ├── session-*.ts    # 会话管理工具
│   │       │       ├── custom-provider-*.ts  # Provider 管理
│   │       │       └── theme-*.ts      # 主题工具
│   │       ├── routes/
│   │       │   ├── sessions.ts   # 会话 CRUD
│   │       │   ├── models.ts     # 模型列表
│   │       │   ├── config.ts     # 配置管理
│   │       │   └── events.ts     # SSE 流
│   │       └── index.ts
│   │
│   ├── app/                 # React + Vite + Tauri 前端
│   │   └── src/
│   │       ├── components/
│   │       │   ├── layout/       # Sidebar, ChatPanel, ActivityPanel
│   │       │   ├── chat/         # MessageList, InputArea, ThinkingBlock
│   │       │   ├── activity/     # TurnGroup, StreamingTurn ⭐
│   │       │   ├── config/       # ProviderSettings, MemorySettings, AppearanceSettings
│   │       │   └── ModelSelector.tsx
│   │       ├── stores/           # Zustand 状态管理
│   │       ├── hooks/            # useSSE, useApi, useSession
│   │       ├── lib/
│   │       │   ├── api.ts        # API 客户端
│   │       │   ├── theme.ts      # 主题工具函数
│   │       │   └── colors.ts     # oklch 颜色转换
│   │       └── styles/
│   │           └── globals.css   # Tailwind v4 + oklch 变量
│   │
│   └── db/                  # Prisma + SQLite
│       └── prisma/
│           └── schema.prisma     # 数据库模型定义
│               - Session: id, name, model, workingPath, modifiedFiles, ...
│               - Agent: id, name, emoji, vibe, defaultModel, ...
│               - CustomProvider & CustomModel: 自定义模型配置
│               - CustomTheme: 自定义主题存储
│               - CronJob: 定时任务
│
├── justfile                  # 任务命令定义
└── package.json              # Bun workspaces 配置
```

## 🧠 Memory 系统

Apex 实现了完整的 Agent 记忆机制，让 Agent 拥有持久化的上下文和个性。

### Agent Workspace 结构

每个 Agent 拥有独立的工作空间：

```
~/.config/apex/agents/{agent-name}/
├── AGENTS.md       # 行为指令
├── SOUL.md         # 核心人格定义
├── IDENTITY.md     # 身份信息
├── USER.md         # 用户信息
├── MEMORY.md       # 长期记忆（偏好、决策、教训）
├── HEARTBEAT.md    # 心跳任务（可选）
└── memory/         # 每日记忆日志
    └── YYYY-MM-DD.md
```

### 记忆类型

| 文件                   | 用途                              |
| ---------------------- | --------------------------------- |
| `MEMORY.md`            | 长期记忆 - 重要的偏好、决策、教训 |
| `memory/YYYY-MM-DD.md` | 每日日志 - 当天的上下文和事件     |

### 搜索能力

Memory 系统支持两种搜索模式：

| 模式                | 说明                     | 配置要求             |
| ------------------- | ------------------------ | -------------------- |
| **BM25 关键词搜索** | 基于词频的全文搜索       | 无需配置，开箱即用   |
| **向量语义搜索**    | 基于嵌入向量的语义相似度 | 需配置 Embedding API |
| **混合搜索**        | 70% 向量 + 30% 关键词    | 需配置 Embedding API |

### Embedding Providers

支持多种 Embedding 服务：

| Provider | 模型                   | 维度 |
| -------- | ---------------------- | ---- |
| OpenAI   | text-embedding-3-small | 1536 |
| Gemini   | gemini-embedding-001   | 768  |
| Voyage   | voyage-4-large         | 1024 |

### Memory 工具

Agent 自动获得记忆工具：

```
# 语义搜索记忆
memory_search(query="OpenClaw memory 设计", maxResults=10)

# 读取特定记忆片段
memory_get(path="memory/2026-02-13.md", from=50, lines=20)
```

### Memory Flush

在对话 compaction 之前自动保存重要记忆，确保长期上下文不会丢失：

- 触发时机：距离 compaction 阈值 4000 tokens
- 自动提取重要信息写入每日日志
- 定期同步到 SQLite 向量数据库

### 配置 Memory

在前端设置页面配置 Embedding Provider：

1. 打开设置 → Memory
2. 选择 Embedding Provider（OpenAI/Gemini/Voyage）
3. 输入 API Key
4. 保存配置

配置后 Agent 将自动使用混合搜索获得更精准的记忆召回。

## 🛠️ 技术栈

### 后端

- **Runtime**: [Bun](https://bun.sh) - 高性能 JavaScript 运行时
- **Framework**: [Elysia](https://elysiajs.com) - 极速 TypeScript 框架
- **AI SDK**: [@mariozechner/pi-coding-agent](https://github.com/badlogic/pi-mono)
- **Database**: SQLite + [Prisma](https://prisma.io) ORM
- **Stream**: Server-Sent Events (SSE)

### 前端

- **Framework**: React 19
- **Build Tool**: Vite 6
- **Desktop**: [Tauri v2](https://tauri.app)
- **Styling**: Tailwind CSS v4 + oklch 颜色格式
- **State**: [Zustand](https://github.com/pmndrs/zustand)
- **Icons**: [Lucide React](https://lucide.dev)
- **Color System**: oklch - 感知均匀颜色空间

### 代码质量

- **Formatter**: [oxfmt](https://github.com/oxc-project/oxc)
- **Linter**: [oxlint](https://github.com/oxc-project/oxc)
- **Type Check**: TypeScript 5.8

## 📋 可用命令

### 开发

```bash
just dev              # 启动所有服务
just dev-server       # 仅后端 (:3001)
just dev-app          # 仅前端 (:5173)
just dev-tauri        # 桌面应用
```

### 代码质量

```bash
just fmt              # 格式化 (oxfmt)
just lint             # 检查 (oxlint)
just fix              # 自动修复
just typecheck        # TypeScript 检查
```

### 数据库

```bash
just db-generate      # 生成 Prisma Client
just db-push          # 推送 schema（开发用）
just db-migrate       # 创建 migration
just db-studio        # Prisma Studio 可视化界面
just db-reset         # 重置数据库
```

### 构建

```bash
just build-app        # 构建前端
just build-tauri      # 构建桌面应用
just clean            # 清理构建产物
```

## ⚙️ 配置说明

### 模型配置

1. **内置模型** - 自动识别系统中已配置 API Key 的模型（OpenAI、Anthropic 等）

2. **自定义 Provider** - 支持添加任意 OpenAI-compatible API：
    - 配置 API Key、Base URL
    - 定义多个模型及其参数
    - 指定 API 协议（openai-completions、anthropic-messages 等）

### API Key 配置

在启动应用前设置环境变量：

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

或在应用内通过自定义 Provider 配置。

### 主题系统

#### 内置主题（15 组）

**亮色主题**（5 组）：

- Default Light - 简约白
- Gruvbox Light - 柔和米黄
- Solarized Light - 经典浅色
- Catppuccin Latte - 奶猫拿铁
- Rose Pine Dawn - 玫瑰晨曦

**暗色主题**（10 组）：

- Default Dark - 简约黑
- Dracula - 德古拉紫
- Nord - 北极光蓝
- Gruvbox Dark - 古朴暗色
- Monokai - 经典代码编辑器配色
- Catppuccin Mocha - 奶猫摩卡
- Solarized Dark - 经典深色
- Tokyo Night - 东京夜景
- One Dark Pro - VS Code 暗色
- Rose Pine Moon - 玫瑰月色

#### AI 生成主题

通过自然语言对话让 AI 为你创建主题：

```
你: 创建一个蓝色的暗色主题
AI: (调用 generate_theme 工具) 已生成主题并激活
```

#### 自定义主题

1. 复制现有主题
2. 编辑 22 个语义化颜色变量
3. 实时预览效果
4. 导出为 JSON 分享

## 🔌 API 端点

### 会话管理

```
GET    /api/sessions          # 列出所有会话
POST   /api/sessions          # 创建会话
GET    /api/sessions/:id      # 获取会话详情
DELETE /api/sessions/:id      # 删除会话
POST   /api/sessions/:id/prompt   # 发送消息
POST   /api/sessions/:id/model    # 设置模型
POST   /api/sessions/:id/steer    # 引导回复方向
POST   /api/sessions/:id/abort    # 中断生成
```

### 模型管理

```
GET    /api/models            # 获取可用模型列表
```

### 配置管理

```
GET    /api/config            # 获取配置
PATCH  /api/config            # 更新配置
GET    /api/config/providers  # 获取自定义 Providers
POST   /api/config/providers  # 添加 Provider
DELETE /api/config/providers/:name  # 删除 Provider
```

### 事件流

```
GET    /api/events            # 全局事件流（SSE）
GET    /api/sessions/:id/events  # 会话事件流（SSE）
```

**事件类型**：

- `agent_start/end` - Agent 会话开始/结束
- `message_start/update/end` - 消息流式传输
- `text_delta` - 文本增量
- `thinking_delta` - 思考增量
- `tool_call_start/end` - 工具调用
- `tool_execution_start/update/end` - 工具执行
- `error` - 错误事件

## 📚 项目知识库

项目包含分层的 AGENTS.md 知识库，为 AI 编码助手提供上下文：

```
./AGENTS.md                           # 根目录 - 项目概览、约定、命令
├── packages/
│   ├── shared/AGENTS.md              # 类型定义包
│   ├── server/AGENTS.md              # 后端 API 包
│   │   ├── src/agent/tools/AGENTS.md # Agent 工具工厂模式
│   │   └── src/agent/memory/AGENTS.md # Memory 系统
│   ├── app/AGENTS.md                 # 前端 React 包
│   │   ├── src/stores/AGENTS.md      # Zustand 状态管理
│   │   ├── src/components/config/AGENTS.md    # 配置组件
│   │   └── src/components/tools/registry/renderers/AGENTS.md  # 工具渲染器
│   └── db/AGENTS.md                  # 数据库包
```

每个目录都有对应的 CLAUDE.md 指向 AGENTS.md，方便 Claude Code 等 AI 工具快速定位上下文。

**当前统计**: 141 源文件, 24760 TS/TSX 行代码, 4 包

## 📝 开发指南

### 添加新工具

1. 在 `packages/server/src/agent/tools/` 创建新文件：

```typescript
// myTool.ts
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { IAgentManager } from "./addCustomProvider.js";

export function createMyTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "my_tool",
    label: "My Tool",
    description: "工具描述",
    parameters: Type.Object({
      param: Type.String({ description: "参数说明" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // 实现逻辑
      return {
        content: [{ type: "text", text: "结果" }],
        details: undefined,
      };
    },
  };
}
```

2. 在 `tools/index.ts` 导出并添加到 `AgentManager`

### 代码规范

- **ESM only** - 所有包使用 `"type": "module"`
- **文件扩展名** - 本地导入使用 `.js` 扩展名
- **命名规范**:
    - PascalCase: 组件、类型、接口
    - camelCase: 函数、变量、hooks
    - kebab-case: 目录名

### 主题开发

**颜色格式**：使用 oklch

```typescript
const color: ColorDefinition = { l: 0.5, c: 0.1, h: 250 };
// l: 亮度 (0-1), c: 色度 (0-0.25), h: 色相 (0-360)
```

**颜色变量**：通过 CSS 变量动态应用

```typescript
applyThemeToDOM(themeConfig); // 应用到 :root
```

## 🎯 核心设计

### Session 文件追踪

自动追踪并显示当前 Session 中修改的文件：

- **实时追踪** - 监听 `edit` 和 `write` 工具调用，记录修改的文件路径
- **前端展示** - 文件面板顶部显示修改的文件列表，点击可查看
- **持久化存储** - 文件修改记录保存到数据库，重启后保留
- **数据流**：
  ```
  工具调用 → file-tracker 扩展 → ManagedSession.modifiedFiles → 数据库
                                     ↓
                              前端 FilePanel 显示
  ```

### Turn-based Activity 系统

Activity 面板按对话回合（Turn）展现思考和工具调用：

- **当前回合** - 实时显示流式中的思考过程和工具执行
- **历史回合** - 按时间倒序排列，点击展开查看详细
- **联动机制** - 点击主对话区的消息，对应回合在 Activity 面板高亮

### 自定义工具架构

```
AgentManager
├── Provider 管理
│   ├── add_custom_provider    - 添加 AI 提供商
│   ├── list_custom_providers  - 列出提供商
│   └── update_custom_provider - 更新提供商
├── 主题管理
│   ├── get_themes    - 获取主题列表
│   ├── generate_theme - AI 生成主题
│   └── set_theme     - 切换主题
├── 会话管理
│   ├── create_session - 创建会话
│   ├── get_session    - 获取会话详情
│   └── rename_session - 重命名会话
├── 记忆系统
│   ├── memory_search - 语义搜索记忆
│   └── memory_get    - 读取记忆文件
└── 文件操作
    ├── grep - 搜索文件内容
    └── glob - 查找文件
```

所有工具遵循统一的工厂函数模式，易于扩展。

## 🔄 数据流

```
User Message
    ↓
AgentManager (Server)
    ├─ Thinking Process → Activity Panel (实时)
    ├─ Tool Call → Tool Executor (Server)
    │   └─ Result → Activity Panel
    └─ Response → Chat Panel (流式)
```

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT

## 🙏 致谢

- [pi-mono](https://github.com/badlogic/pi-mono) - 底层 AI Agent SDK
- [Tauri](https://tauri.app) - 桌面应用框架
- [Elysia](https://elysiajs.com) - Web 框架
- [Bun](https://bun.sh) - JavaScript 运行时
- [Lucide](https://lucide.dev) - 图标库
- [Tailwind CSS](https://tailwindcss.com) - CSS 框架

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/fzdwx">fzdwx</a>
</div>
