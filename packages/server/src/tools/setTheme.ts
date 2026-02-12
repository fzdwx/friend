import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { ThemeConfig } from "@friend/shared";
import { prisma } from "@friend/db";
import { getAllBuiltInThemes } from "./themeUtils.js";
import type { IAgentManager } from "./addCustomProvider.js";

// ─── Tool Parameters Schema ────────────────────────────────

export const SetThemeParams = Type.Object({
  themeId: Type.Union(
    [
      Type.String({ description: "Theme ID to set as active. Use get_themes to see available themes." }),
      Type.Literal("light", { description: "Use the default light theme" }),
      Type.Literal("dark", { description: "Use the default dark theme" }),
    ],
    { description: "Theme ID or 'light'/'dark' shortcut" },
  ),
});

// ─── Tool Definition ───────────────────────────────────────

export function createSetThemeTool(manager: IAgentManager): ToolDefinition {  return {
    name: "set_theme",
    label: "Set Theme",
    description: "Set the active theme for the application. Changes the visual appearance.",
    parameters: SetThemeParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const p = params as { themeId: string };

        let themeId = p.themeId;

        // Handle shortcuts
        if (themeId === "light") {
          themeId = "default-light";
        } else if (themeId === "dark") {
          themeId = "default-dark";
        }

        // Verify theme exists
        const builtInThemes = getAllBuiltInThemes();
        const builtInTheme = builtInThemes.find((t) => t.id === themeId);

        if (!builtInTheme) {
          // Check custom themes
          const customTheme = await prisma.customTheme.findUnique({
            where: { id: themeId },
          });

          if (!customTheme) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Theme "${themeId}" not found. Use get_themes to see available themes.`,
                },
              ],
              details: undefined,
            };
          }
        }

        // Update config
        if (manager.updateConfig) {
          await manager.updateConfig({ activeThemeId: themeId });
        } else {
          return {
            content: [
              {
                type: "text" as const,
                text: "Theme setting is not supported on this agent manager.",
              },
            ],
            details: undefined,
          };
        }

        const themeName = builtInTheme?.name || `Custom theme (${themeId})`;
        const themeMode = builtInTheme?.mode || "system";

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully set theme to "${themeName}" (${themeMode}). The active theme ID is: ${themeId}`,
            },
          ],
          details: {
            themeId,
            themeName,
            themeMode,
          },
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to set theme: ${String(err)}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
