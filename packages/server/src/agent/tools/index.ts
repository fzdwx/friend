// Custom tools for the agent
// This directory contains all custom tools that extend the agent's capabilities

// Re-export manager interfaces from centralized location
export type { IAgentManager, ICronManager } from "../managers/types.js";

// Custom Provider
export { createAddProviderTool, AddCustomProviderParams } from "./custom-provider-add";
export { createListProvidersTool } from "./custom-provider-list";
export { createUpdateProviderTool, UpdateCustomProviderParams } from "./custom-provider-update";

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
export { createSessionSearchTool, SessionSearchParams } from "./session-search";

// Memory Tools
export { createMemorySearchTool, createMemoryGetTool, MemorySearchParams, MemoryGetParams } from "./memory.js";

// Question Tool
export { createQuestionTool } from "./question.js";

// Cron Tool
export { createCronTool, CronParams } from "./cron.js";

// Skill Tools
export { createSkillCreateTool, SkillCreateParams } from "./skill-create.js";
export { createSkillUpdateTool, SkillUpdateParams } from "./skill-update.js";
export { createSkillListTool, SkillListParams } from "./skill-list.js";

// Notify Tool
export { notifyTool } from "./notify.js";
