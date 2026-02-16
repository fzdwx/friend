import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getAllBuiltInThemes } from "./theme-utils";
import type { IAgentManager } from "../managers/types.js";

export const SetThemeParams = Type.Object({
  themeId: Type.Union(
    [
      Type.String({
        description: "Theme ID to set as active. Use get_themes to see available themes.",
      }),
      Type.Literal("light", { description: "Use the default light theme" }),
      Type.Literal("dark", { description: "Use the default dark theme" }),
    ],
    { description: "Theme ID or 'light'/'dark' shortcut" },
  ),
});

export function createSetThemeTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "set_theme",
    label: "Set Theme",
    description: "Set the active theme for the application. Changes the visual appearance.",
    parameters: SetThemeParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const p = params as { themeId: string };
        let themeId = p.themeId;

        if (themeId === "light") themeId = "default-light";
        else if (themeId === "dark") themeId = "default-dark";

        if (!manager.setActiveTheme) {
          return {
            content: [{ type: "text" as const, text: "Theme setting is not supported." }],
            details: undefined,
          };
        }

        await manager.setActiveTheme(themeId);

        const builtIn = getAllBuiltInThemes().find((t) => t.id === themeId);
        const themeName = builtIn?.name || `Custom theme (${themeId})`;

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully set theme to "${themeName}". Active theme ID: ${themeId}`,
            },
          ],
          details: { themeId, themeName },
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to set theme: ${String(err)}` }],
          details: undefined,
        };
      }
    },
  };
}
