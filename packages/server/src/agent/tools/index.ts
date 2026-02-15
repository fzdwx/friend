// Custom tools for the agent
// This directory contains all custom tools that extend the agent's capabilities

// Custom Provider
export { createAddProviderTool, AddCustomProviderParams } from "./custom-provider-add";
export { createListProvidersTool } from "./custom-provider-list";
export { createUpdateProviderTool, UpdateCustomProviderParams } from "./custom-provider-update";
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
export { createCreateSessionTool, CreateSessionParams } from "./session-create";

// Memory Tools
export { createMemorySearchTool, createMemoryGetTool, MemorySearchParams, MemoryGetParams } from "./memory.js";

// Question Tool
export { createQuestionTool } from "./question.js";

// Cron Tool
export { createCronTool, CronParams } from "./cron.js";
export type { ICronManager } from "./custom-provider-add";
