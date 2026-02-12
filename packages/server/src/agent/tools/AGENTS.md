# AGENT TOOLS MODULE

**Location:** `packages/server/src/agent/tools/`
**Purpose:** Custom AI Agent tools for theme management and provider configuration

---

## STRUCTURE

```
tools/
├── index.ts                    # Tool factory registry
├── addCustomProvider.ts        # Add OpenAI-compatible AI provider
├── getThemes.ts                # List available themes
├── generateTheme.ts            # AI-generate custom theme
├── setTheme.ts                 # Switch active theme
├── themeUtils.ts               # Theme utility functions
├── README.md                   # Tool implementation guide
└── THEME_TOOLS.md              # Theme tools documentation
```

---

## WHERE TO LOOK

| Task             | File                   |
| ---------------- | ---------------------- |
| 工具注册         | `index.ts`             |
| 添加 AI 提供商   | `addCustomProvider.ts` |
| 主题生成工具     | `generateTheme.ts`     |
| 主题工具实用函数 | `themeUtils.ts`        |

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

## TOOL RESPONSIBILITIES

| Tool                  | Purpose                        | Key Files              |
| --------------------- | ------------------------------ | ---------------------- |
| `get_themes`          | Query available themes         | `getThemes.ts`         |
| `generate_theme`      | AI-generate custom theme       | `generateTheme.ts`     |
| `set_theme`           | Switch active theme            | `setTheme.ts`          |
| `add_custom_provider` | Add OpenAI-compatible provider | `addCustomProvider.ts` |

---

## NOTES

- **测试**: 仅有 `test_tool.js` 手动测试文件，无正式测试框架
- **扩展性**: 添加新工具需遵循工厂函数模式并在 `index.ts` 中注册
- **状态访问**: 通过 `IAgentManager` 访问 Prisma、配置、当前会话等状态
