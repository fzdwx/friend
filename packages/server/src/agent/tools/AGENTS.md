# AGENT TOOLS MODULE

**Location:** `packages/server/src/agent/tools/`
**Purpose:** Custom AI Agent tools (14 tools: theme/provider/session/memory/search)
**Files:** 14 TypeScript files

---

## STRUCTURE

```
tools/
├── index.ts                      # Tool factory registry
├── custom-provider-add.ts        # Add OpenAI-compatible provider
├── custom-provider-list.ts       # List all providers
├── custom-provider-update.ts     # Update provider config
├── theme-get.ts                  # List available themes
├── theme-generate.ts             # AI-generate custom theme
├── theme-set.ts                  # Switch active theme
├── theme-utils.ts                # Theme utility functions
├── session-create.ts             # Create new session
├── session-get.ts                # Get session details
├── session-rename.ts             # Rename session
├── memory.ts                     # memory_search, memory_get
├── grep.ts                       # Search file contents (ripgrep)
└── glob.ts                       # Find files by pattern
```

---

## WHERE TO LOOK

| Task             | File                     |
| ---------------- | ------------------------ |
| 工具注册         | `index.ts`               |
| 添加 AI 提供商   | `custom-provider-add.ts` |
| 主题生成工具     | `theme-generate.ts`      |
| 主题工具实用函数 | `theme-utils.ts`         |

---

## PATTERNS

### Factory Function Pattern

```typescript
export function createToolName(manager: IAgentManager): ToolDefinition {
  return {
    name: "tool_name",
    label: "Tool Name",
    description: "Description",
    parameters: Type.Object({
      param: Type.String({ description: "Parameter" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Implementation
      return {
        content: [{ type: "text", text: "Result" }],
        details: undefined,
      };
    },
  };
}
```

**Convention**: All tools follow this factory pattern, receive `IAgentManager` for state access

### Tool Registration

```typescript
// index.ts - Export all tool factories
export function createTools(manager: IAgentManager): ToolDefinition[] {
  return [
    createGetThemesTool(manager),
    createGenerateThemeTool(manager),
    createSetThemeTool(manager),
    createAddCustomProviderTool(manager),
  ];
}
```

**Convention**: Export `createTools()` function that returns array of tool definitions

---

## ANTI-PATTERNS

- 不要在工具函数中直接访问数据库: 通过 `manager.getPrisma()`
- 不要忽略 `signal` 参数: 支持取消操作
- 不要在 `execute` 中抛出异常: 返回错误信息在 `details` 字段

---

## CONVENTIONS

- **返回格式**: 必须返回 `{ content: [...], details?: string }`
- **更新进度**: 使用 `onUpdate()` 报告中间状态
- **类型定义**: 使用 `@sinclair/typebox` 的 `Type.Object()` 定义参数
- **工具调用 ID**: 第一个参数始终是 `toolCallId`

---

## TOOL RESPONSIBILITIES (14 Tools)

| Tool                     | Purpose                        | File                        |
| ------------------------ | ------------------------------ | --------------------------- |
| `add_custom_provider`    | Add OpenAI-compatible provider | `custom-provider-add.ts`    |
| `list_custom_providers`  | List registered providers      | `custom-provider-list.ts`   |
| `update_custom_provider` | Update provider config         | `custom-provider-update.ts` |
| `get_themes`             | Query available themes         | `theme-get.ts`              |
| `generate_theme`         | AI-generate custom theme       | `theme-generate.ts`         |
| `set_theme`              | Switch active theme            | `theme-set.ts`              |
| `create_session`         | Create new session             | `session-create.ts`         |
| `get_session`            | Get session details            | `session-get.ts`            |
| `rename_session`         | Rename session                 | `session-rename.ts`         |
| `memory_search`          | Semantic search memories       | `memory.ts`                 |
| `memory_get`             | Read memory file               | `memory.ts`                 |
| `grep`                   | Search file contents           | `grep.ts`                   |
| `glob`                   | Find files by pattern          | `glob.ts`                   |

---

## NOTES

- **测试**: 仅有 `test_tool.js` 手动测试文件，无正式测试框架
- **扩展性**: 添加新工具需遵循工厂函数模式并在 `index.ts` 中注册
- **状态访问**: 通过 `IAgentManager` 访问 Prisma、配置、当前会话等状态
