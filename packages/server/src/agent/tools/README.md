# Custom Tools Directory

This directory contains custom tools that extend the capabilities of the AI agent.

## Structure

```
tools/
├── index.ts                 # Main export file
├── custom-provider-add.ts     # Tool for adding custom providers
├── grep.ts                 # Tool for searching file contents using ripgrep
├── glob.ts                 # Tool for finding files using glob patterns
├── theme-get.ts            # Tool for getting available themes
├── theme-generate.ts        # Tool for generating custom themes
├── theme-set.ts             # Tool for setting active theme
├── theme-utils.ts           # Theme utility functions
└── README.md               # This file
```

## Overview

Custom tools are self-contained functions that can be called by the agent to perform specific actions. Each tool is defined as a separate module in this directory.

## Available Tools

### Grep / Search Files (`grep`)

**File:** `grep.ts`

Search for text patterns in files using ripgrep. Supports regular expressions, file filtering with glob patterns, case-sensitive/insensitive searching, and path validation.

#### Features

- ✅ Regular expression pattern matching
- ✅ Custom search paths with validation
- ✅ File include/exclude filtering using glob patterns
- ✅ Case-sensitive or case-insensitive search
- ✅ Configurable result limits
- ✅ Hidden files support
- ✅ Results sorted by file modification time (most recent first)
- ✅ Path validation (ensures directory is accessible)
- ✅ Detailed search metadata in response

#### Parameters

- `pattern` (string, required): The regex pattern to search for in file contents
- `path` (string, optional): The directory to search in. Defaults to current working directory
- `include` (string, optional): File pattern to include (e.g., "_.js", "_.{ts,tsx}")
- `exclude` (string, optional): File pattern to exclude (e.g., "\*.test.js", "node_modules")
- `caseSensitive` (boolean, optional): Case-sensitive search. Defaults to false
- `maxResults` (number, optional): Maximum number of results to return. Defaults to 100

#### Usage Examples

```typescript
// Search for a function name in all TypeScript files
await tool.execute(
  "grep-1",
  {
    pattern: "AgentManager",
    path: "./src/agent",
    include: "*.ts",
  },
  signal,
  undefined,
  ctx,
);

// Case-sensitive search
await tool.execute(
  "grep-2",
  {
    pattern: "Agent",
    path: "./src/agent",
    caseSensitive: true,
    maxResults: 10,
  },
  signal,
  undefined,
  ctx,
);

// Search excluding test files
await tool.execute(
  "grep-3",
  {
    pattern: "import",
    path: "./src",
    include: "*.ts",
    exclude: "*.test.ts",
  },
  signal,
  undefined,
  ctx,
);
```

#### Response Details

The tool returns both a formatted text output and a details object:

```typescript
{
  content: [{ type: "text", text: "Found 5 matches\n..." }],
  details: {
    matches: 5,
    truncated: false,
    searchPath: "/absolute/path/to/search",
    pattern: "search-term"
  }
}
```

path: "./src",
include: "_.ts",
exclude: "_.test.ts",
}, signal, undefined, ctx);

````

### Glob / Find Files (`glob`)

**File:** `glob.ts`

Find files matching a glob pattern using ripgrep. Supports wildcards like '*', '**', and recursive patterns.

#### Features

- ✅ Glob pattern matching (supports *, **, ?, and character classes)
- ✅ Custom search paths with validation
- ✅ Hidden files support
- ✅ Results sorted by file modification time (most recent first)
- ✅ Configurable result limits
- ✅ Path validation (ensures directory is accessible)
- ✅ Detailed search metadata in response

#### Glob Pattern Examples

- `*.ts` - All TypeScript files in the current directory
- `**/*.ts` - All TypeScript files in the current directory and subdirectories
- `src/**/*.js` - All JavaScript files under the src directory
- `*.{ts,tsx}` - All TypeScript and TSX files
- `test_*.js` - All JavaScript files starting with "test_"
- `[A-Z]*.md` - All Markdown files starting with uppercase letters

#### Parameters

- `pattern` (string, required): The glob pattern to match files against (e.g., '*.ts', 'src/**/*.js')
- `path` (string, optional): The directory to search in. Defaults to current working directory
- `maxResults` (number, optional): Maximum number of results to return. Defaults to 100

#### Usage Examples

```typescript
// Find all TypeScript files
await tool.execute("glob-1", {
  pattern: "*.ts",
  path: "./src",
}, signal, undefined, ctx);

// Find all JavaScript files recursively
await tool.execute("glob-2", {
  pattern: "**/*.js",
}, signal, undefined, ctx);

// Find all test files
await tool.execute("glob-3", {
  pattern: "**/*.test.ts",
  path: "./src",
  maxResults: 20,
}, signal, undefined, ctx);
````

#### Response Details

The tool returns both a formatted text output and a details object:

```typescript
{
  content: [{
    type: "text",
    text: "Found 5 files\n\n/path/to/file1.ts\n/path/to/file2.ts\n..."
  }],
  details: {
    count: 5,
    truncated: false,
    searchPath: "/absolute/path/to/search",
    pattern: "*.ts"
  }
}
```

### Add Custom Provider (`add_custom_provider`)

**File:** `custom-provider-add.ts`

Registers a custom OpenAI-compatible LLM provider.

#### Parameters

- `name` (string): Provider name (e.g., 'my-openai')
- `baseUrl` (string): Base URL of the OpenAI-compatible API
- `apiKey` (string, optional): API key for authentication
- `api` (string, optional): API protocol. Defaults to "openai-completions"
- `headers` (Record<string, string>, optional): Extra HTTP headers
- `models` (array): List of models available from this provider
  - `id` (string): Model ID (e.g., 'gpt-4o')
  - `name` (string): Human-readable display name
  - `reasoning` (boolean): Whether the model supports extended thinking
  - `contextWindow` (number): Max context window in tokens
  - `maxTokens` (number): Max output tokens
  - `cost` (object): Cost configuration
    - `input` (number): Cost per 1M input tokens in USD
    - `output` (number): Cost per 1M output tokens in USD
    - `cacheRead` (number): Cost per 1M cache-read tokens in USD
    - `cacheWrite` (number): Cost per 1M cache-write tokens in USD

### Get Themes (`get_themes`)

**File:** `theme-get.ts`

Get a list of all available themes including built-in and custom themes.

#### Parameters

- `mode` (string, optional): Filter by mode ('light', 'dark', or 'system')
- `builtInOnly` (boolean, optional): If true, only return built-in themes

### Generate Theme (`generate_theme`)

**File:** `theme-generate.ts`

Generate a custom theme based on a base hue and saturation.

#### Parameters

- `name` (string, optional): Name for the generated theme
- `mode` (string): Theme mode ('light' or 'dark')
- `hue` (number, 0-360): Base hue value for the primary color
- `saturation` (number, 0-0.25): Base saturation value for the primary color
- `save` (boolean): If true, save the theme to database (default: true)

### Set Theme (`set_theme`)

**File:** `theme-set.ts`

Set the active theme for the application.

#### Parameters

- `themeId` (string or 'light'/'dark'): Theme ID or shortcut

### Rename Session (`rename_session`)

**File:** `session-rename.ts`

Rename a session to make it easier to identify and organize conversations. This tool allows you to change the name of any session at any time.

#### Features

- ✅ Rename any existing session
- ✅ Automatic session ID validation
- ✅ Prevents unnecessary renames (same name check)
- ✅ Broadcasts `session_renamed` event for real-time UI updates
- ✅ Returns old and new names for confirmation

#### Parameters

- `sessionId` (string, required): The ID of the session to rename. This is a unique identifier for the session.
- `newName` (string, required): The new name for the session. Should be brief and descriptive (≤50 characters recommended).

#### Usage Examples

```typescript
// Simple rename
await tool.execute(
  "rename-1",
  {
    sessionId: "session-abc123",
    newName: "Debugging API errors",
  },
  signal,
  undefined,
  ctx,
);

// Rename with AI-generated title
const aiTitle = await generateTitle(sessionContext);
await tool.execute(
  "rename-2",
  {
    sessionId: session.id,
    newName: aiTitle,
  },
  signal,
  undefined,
  ctx,
);

// Rename to organize projects
await tool.execute(
  "rename-3",
  {
    sessionId: "session-def456",
    newName: "React hooks refactoring",
  },
  signal,
  undefined,
  ctx,
);
```

#### Response Details

```typescript
{
  content: [{
    type: "text",
    text: "Successfully renamed session from 'Session 1' to 'Debugging API errors'."
  }],
  details: {
    sessionId: "session-abc123",
    oldName: "Session 1",
    newName: "Debugging API errors"
  }
}
```

#### Error Handling

The tool handles various error scenarios:

- **Session not found**: Returns error message if the sessionId doesn't exist
- **Same name**: Returns message if the new name is the same as the current name
- **Rename failure**: Returns error if the rename operation fails internally

### Get Session Info (`get_session`)

**File:** `session-get.ts`

Get detailed information about the current session or a specific session, including meta data and optionally the full message history.

#### Features

- ✅ Auto-detects current session if no sessionId is provided
- ✅ Returns complete session meta information
- ✅ Optional full message history or preview
- ✅ Useful for understanding session context before renaming or other operations

#### Parameters

- `sessionId` (string, optional): The ID of the session to get details for. If not provided, uses the current interactive session.
- `includeMessages` (boolean, optional): Whether to include the full message history. Defaults to false (meta info only).

#### Usage Examples

```typescript
// Get info about current session (auto-detected)
await tool.execute("get-1", {}, signal, undefined, ctx);

// Get info with full message history
await tool.execute(
  "get-2",
  {
    includeMessages: true,
  },
  signal,
  undefined,
  ctx,
);

// Get info about specific session
await tool.execute(
  "get-3",
  {
    sessionId: "session-abc123",
  },
  signal,
  undefined,
  ctx,
);

// Check session before renaming
const sessionInfo = await tool.execute("get-4", {}, signal, undefined, ctx);
const currentName = sessionInfo.details.session.name;
// Now rename with context...
```

#### Response Details

```typescript
{
  content: [{
    type: "text",
    text: `Session "Debugging API errors" (abc-123-def)

📊 Meta Information:
  - Name: Debugging API errors
  - Model: openai/gpt-4o
  - Working Path: /home/user/project
  - Message Count: 15
  - Created: 2/12/2026, 10:30:00 AM
  - Updated: 2/12/2026, 4:25:00 PM

💬 Last 3 messages:
- [user] How do I fix this API error?
- [assistant] Let me check the logs...
- [user] That worked! Thanks!

Use includeMessages=true to get the full message history.`
  }],
  details: {
    session: { id, name, model, workingPath, ... },
    messagePreview: [...]
  }
}
```

## Usage

Tools are imported and registered in the `AgentManager`:

```typescript
import {
  createAddProviderTool,
  createGetThemesTool,
  createGenerateThemeTool,
  createSetThemeTool,
  createGrepTool,
  createGlobTool,
  createRenameSessionTool,
  createGetSessionTool,
} from "./tools/index.js";

// Create tools with an agent manager instance
const tools = [
  createAddProviderTool(agentManager),
  createGetThemesTool(agentManager),
  createGenerateThemeTool(agentManager),
  createSetThemeTool(agentManager),
  createGrepTool(),
  createGlobTool(),
  createRenameSessionTool(agentManager),
  createGetSessionTool(agentManager),
];

// Use with AgentSession
await createAgentSession({
  customTools: tools,
  // ... other options
});
```

## Adding New Tools

To add a new custom tool:

1. Create a new file in this directory (e.g., `myTool.ts`)
2. Define your tool using the `ToolDefinition` interface from `@mariozechner/pi-coding-agent`
3. Export it from `index.ts`

### Example: Creating a New Tool

```typescript
// myTool.ts
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

export function createMyTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "my_tool",
    label: "My Tool",
    description: "Description of what the tool does",
    parameters: Type.Object({
      paramName: Type.String({ description: "Parameter description" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Implement your tool logic here
      return {
        content: [
          {
            type: "text",
            text: "Tool result",
          },
        ],
        details: undefined,
      };
    },
  };
}
```

Then update `index.ts`:

```typescript
export { createMyTool } from "./myTool.js";
```

And register it in `agent/manager.ts`:

```typescript
import { createMyTool } from "../tools/index.js";

// In createAgentSession calls
customTools: [
  createAddProviderTool(this),
  createGetThemesTool(this),
  createGenerateThemeTool(this),
  createSetThemeTool(this),
  createGrepTool(),
  createGlobTool(),
  createRenameSessionTool(this),
  createMyTool(this),
];
```

## Tool Implementation Guidelines

1. **Use Typebox for parameter schemas**: Define your parameters using `Type.Object()`, `Type.String()`, etc.
2. **Return proper structure**: Always return an object with `content` array and optional `details`
3. **Error handling**: Return error messages in the text content if something goes wrong
4. **Signal handling**: Respect the `signal` parameter for cancellation support
5. **Progress updates**: Use `onUpdate` to provide progress information if needed
6. **Database persistence**: Use `@friend/db` prisma client for data persistence
