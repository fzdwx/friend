// Custom tools for the agent
// This directory contains all custom tools that extend the agent's capabilities

// Custom Provider
export { createAddProviderTool, AddCustomProviderParams } from "./custom-provider-add";
export type { IAgentManager } from "./custom-provider-add";

// Theme Tools
export { createGetThemesTool } from "./theme-get";
export { createGenerateThemeTool, GenerateThemeParams } from "./theme-generate";
export { createSetThemeTool, SetThemeParams } from "./theme-set";

// Search Tools
export { createGrepTool, GrepParams } from "./grep.js";
export { createGlobTool, GlobParams } from "./glob.js";

// Session Tools
export { createRenameSessionTool, RenameSessionParams } from "./session-rename";
export { createGetSessionTool, GetSessionParams } from "./session-get";

// Memory Tools
export { createMemorySearchTool, createMemoryGetTool, MemorySearchParams, MemoryGetParams } from "./memory.js";
