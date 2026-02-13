# Agent System - Final Implementation

## 概述

多 agent 人格系统，agents 存储在数据库，workspace 文件在 `~/.config/friend/agents/{id}/workspace/`。

## 数据库结构

```prisma
model Agent {
  id             String   @id
  name           String
  isDefault      Boolean  @default(false)
  emoji          String?
  vibe           String?
  avatar         String?
  defaultModel   String?
  thinkingLevel  String?
  workspacePath  String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model Session {
  id          String   @id
  name        String
  agentId     String   @default("main")
  // ...
}
```

## 目录结构

```
~/.config/friend/
├── friend.db              # SQLite 数据库
├── skills/                # 全局 skills
└── agents/
    ├── main/
    │   ├── workspace/     # bootstrap 文件
    │   │   ├── IDENTITY.md
    │   │   ├── SOUL.md
    │   │   └── ...
    │   ├── sessions/      # session 文件
    │   └── skills/        # agent 特定 skills
    └── coder/
        └── workspace/
```

## API 格式

所有 API 返回统一格式：
```json
{
  "ok": true,
  "data": [...]
}
```

### Agents API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/agents | 列出所有 agents |
| GET | /api/agents/:id | 获取 agent 详情 |
| POST | /api/agents | 创建 agent |
| PUT | /api/agents/:id | 更新 agent |
| DELETE | /api/agents/:id | 删除 agent |
| GET | /api/agents/:id/workspace | 获取 workspace 文件 |
| PUT | /api/agents/:id/workspace/:filename | 更新文件 |

### Sessions API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/sessions | 创建 session（可选 `agentId`） |

## 前端功能

### 设置界面 (Settings → Agents)

- ✅ 显示所有 agents 列表
- ✅ 创建新 agent
- ✅ 编辑 agent（名称、emoji、vibe、model、thinkingLevel）
- ✅ 删除 agent（默认 agent 不可删除）
- ✅ **模型选择下拉框**（从可用模型列表选择）

### Sidebar

- ✅ 创建 session 时选择 agent
- ✅ 显示 session 绑定的 agent

## 初始化流程

1. 服务器启动 → `ensureDefaultAgent()`
2. 检查数据库是否有 agent
3. 如果没有 → 创建默认 `main` agent
4. 创建 workspace 目录和所有 bootstrap 文件
5. IDENTITY.md 使用自定义内容

## 测试

```bash
# 列出 agents
curl http://localhost:3001/api/agents | jq .

# 创建 agent
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{"id": "coder", "name": "Coder", "identity": {"name": "Coder", "emoji": "💻", "vibe": "Efficient"}}' | jq .

# 创建 session 指定 agent
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "agentId": "coder"}' | jq .
```

## 已移除

- ❌ `~/.config/friend/config.json`
- ❌ Project-level `.friend/`
- ❌ Binding rules
- ❌ 自动路径匹配

## 变更文件

- `packages/db/prisma/schema.prisma` - Agent 表
- `packages/server/src/agent/agent-manager.ts` - 数据库操作
- `packages/server/src/agent/bootstrap.ts` - 自定义 IDENTITY.md
- `packages/server/src/routes/agents.ts` - REST API
- `packages/app/src/components/config/AgentsContent.tsx` - UI + 模型选择
- `packages/app/src/stores/agentStore.ts` - 状态管理
