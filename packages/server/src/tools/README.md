# Custom Tools Directory

This directory contains custom tools that extend the capabilities of the AI agent.

## Structure

```
tools/
├── index.ts           # Main export file
├── addCustomProvider.ts  # Tool for adding custom providers
└── README.md          # This file
```

## Overview

Custom tools are self-contained functions that can be called by the agent to perform specific actions. Each tool is defined as a separate module in this directory.

## Available Tools

### Add Custom Provider (`add_custom_provider`)

**File:** `addCustomProvider.ts`

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

## Usage

Tools are imported and registered in the `AgentManager`:

```typescript
import { createAddProviderTool } from "./tools/index.js";

// Create the tool with an agent manager instance
const tool = createAddProviderTool(agentManager);

// Use with AgentSession
await createAgentSession({
  customTools: [tool],
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

interface IAgentManager {
  // Define the methods your tool needs from the manager
}

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
import { createAddProviderTool, createMyTool } from "../tools/index.js";

// In createAgentSession calls
customTools: [createAddProviderTool(this), createMyTool(this)]
```

## Tool Implementation Guidelines

1. **Use Typebox for parameter schemas**: Define your parameters using `Type.Object()`, `Type.String()`, etc.
2. **Return proper structure**: Always return an object with `content` array and optional `details`
3. **Error handling**: Return error messages in the text content if something goes wrong
4. **Signal handling**: Respect the `signal` parameter for cancellation support
5. **Progress updates**: Use `onUpdate` to provide progress information if needed
