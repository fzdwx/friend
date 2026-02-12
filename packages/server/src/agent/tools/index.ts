// Custom tools for the agent
// This directory contains all custom tools that extend the agent's capabilities

// Custom Provider
export { createAddProviderTool, AddCustomProviderParams } from "./addCustomProvider.js";
export type { IAgentManager } from "./addCustomProvider.js";

// Theme Tools
export { createGetThemesTool } from "./getThemes.js";
export { createGenerateThemeTool, GenerateThemeParams } from "./generateTheme.js";
export { createSetThemeTool, SetThemeParams } from "./setTheme.js";
