import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { ThemeConfig } from "@friend/shared";
import { prisma } from "@friend/db";
import { generateThemeFromColor } from "./themeUtils.js";
import type { IAgentManager } from "./addCustomProvider.js";

// ─── Tool Parameters Schema ────────────────────────────────

export const GenerateThemeParams = Type.Object({
  name: Type.Optional(
    Type.String({
      description: "Optional name for the generated theme. If not provided, a default name will be generated.",
    }),
  ),
  mode: Type.Union([Type.Literal("light"), Type.Literal("dark")], {
    description: "Theme mode: 'light' or 'dark'",
  }),
  hue: Type.Number({
    description: "Base hue value (0-360) for the primary color. This determines the overall color tone.",
    minimum: 0,
    maximum: 360,
  }),
  saturation: Type.Number({
    description: "Base saturation value (0-0.25) for the primary color. Higher values are more vibrant.",
    minimum: 0,
    maximum: 0.25,
    default: 0.1,
  }),
  save: Type.Boolean({
    description: "If true, save the generated theme to the database for future use. Defaults to true.",
    default: true,
  }),
});

// ─── Tool Definition ───────────────────────────────────────

export function createGenerateThemeTool(_manager: IAgentManager): ToolDefinition {  return {
    name: "generate_theme",
    label: "Generate Theme",
    description:
      "Generate a custom theme based on a base hue and saturation. This creates a complete color scheme optimized for readability and aesthetics.",
    parameters: GenerateThemeParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const p = params as {
          name?: string;
          mode: "light" | "dark";
          hue: number;
          saturation: number;
          save: boolean;
        };

        // Generate the theme
        const theme = generateThemeFromColor({ h: p.hue, c: p.saturation }, p.mode, p.name);

        if (p.save) {
          // Save to database
          await prisma.customTheme.create({
            data: {
              id: theme.id,
              name: theme.name,
              mode: theme.mode,
              colors: JSON.stringify(theme.colors),
            },
          });
        }

        // Format output
        const colorPreview = `Primary: L=${theme.colors.primary.l}, C=${theme.colors.primary.c}, H=${theme.colors.primary.h}`;

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully generated theme "${theme.name}" (${theme.mode})\n\n${colorPreview}\n\n${p.save ? "Theme has been saved to the database." : "Theme was not saved."}`,
            },
          ],
          details: {
            theme,
          },
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to generate theme: ${String(err)}`,
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
