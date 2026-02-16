import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { ThemeConfig } from "@friend/shared";
import { prisma } from "@friend/db";
import { getAllBuiltInThemes } from "./theme-utils";
import type { IAgentManager } from "../managers/types.js";

// ─── Tool Parameters Schema ────────────────────────────────

const GetThemesFilter = Type.Optional(
  Type.Object({
    mode: Type.Optional(
      Type.Union([Type.Literal("light"), Type.Literal("dark"), Type.Literal("system")], {
        description: "Filter themes by mode (light, dark, or system)",
      }),
    ),
    builtInOnly: Type.Optional(
      Type.Boolean({
        description: "If true, only return built-in themes. If false, return all available themes",
      }),
    ),
  }),
);

// ─── Tool Definition ───────────────────────────────────────

export function createGetThemesTool(_manager: IAgentManager): ToolDefinition {
  return {
    name: "get_themes",
    label: "Get Themes",
    description:
      "Get a list of all available themes. Returns both built-in themes and custom themes created by the user.",
    parameters: GetThemesFilter,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const p = (params as Record<string, any>) || {};

        // Get all built-in themes
        let themes = getAllBuiltInThemes();

        // If not builtInOnly, load custom themes from database
        if (!p.builtInOnly) {
          const customThemes = await prisma.customTheme.findMany({
            orderBy: { updatedAt: "desc" },
          });

          for (const ct of customThemes) {
            try {
              const colors = JSON.parse(ct.colors);
              themes.push({
                id: ct.id,
                name: ct.name,
                mode: ct.mode as "light" | "dark" | "system",
                isPreset: false,
                isBuiltIn: false,
                colors,
              });
            } catch (err) {
              console.error(`Failed to parse theme ${ct.id}:`, err);
            }
          }
        }

        // Filter by mode if specified
        if (p.mode && p.mode !== "system") {
          themes = themes.filter((t) => t.mode === p.mode);
        }

        // Format output
        const themeList = themes.map((t) => ({
          id: t.id,
          name: t.name,
          mode: t.mode,
          isBuiltIn: t.isBuiltIn ?? false,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${themes.length} available themes:\n${themeList
                .map(
                  (t) =>
                    `  - ${t.name} (${t.id}) [${t.mode}${t.isBuiltIn ? ", built-in" : ", custom"}]`,
                )
                .join("\n")}`,
            },
          ],
          details: {
            themes,
          },
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to get themes: ${String(err)}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
