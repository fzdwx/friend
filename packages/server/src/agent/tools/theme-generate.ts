import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { generateThemeFromColor } from "./theme-utils";
import type { IAgentManager } from "./custom-provider-add";

export const GenerateThemeParams = Type.Object({
  name: Type.Optional(Type.String({ description: "Optional name for the generated theme." })),
  mode: Type.Union([Type.Literal("light"), Type.Literal("dark")], {
    description: "Theme mode: 'light' or 'dark'",
  }),
  hue: Type.Number({
    description: "Base hue value (0-360) for the primary color.",
    minimum: 0,
    maximum: 360,
  }),
  saturation: Type.Number({
    description:
      "Base saturation value (0-0.25) for the primary color. Higher values are more vibrant.",
    minimum: 0,
    maximum: 0.25,
    default: 0.1,
  }),
  save: Type.Boolean({
    description:
      "If true, save the generated theme to the database for future use. Defaults to true.",
    default: true,
  }),
});

export function createGenerateThemeTool(manager: IAgentManager): ToolDefinition {
  return {
    name: "generate_theme",
    label: "Generate Theme",
    description:
      "Generate a custom theme based on a base hue and saturation. Creates a complete color scheme optimized for readability.",
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

        const theme = generateThemeFromColor({ h: p.hue, c: p.saturation }, p.mode, p.name);

        if (p.save && manager.addCustomTheme) {
          await manager.addCustomTheme(theme);
        }

        const colorPreview = `Primary: L=${theme.colors.primary.l}, C=${theme.colors.primary.c}, H=${theme.colors.primary.h}`;

        return {
          content: [
            {
              type: "text" as const,
              text: `Generated theme "${theme.name}" (${theme.mode}, id: ${theme.id})\n\n${colorPreview}\n\n${p.save ? "Theme saved. Use set_theme to activate it." : "Theme was not saved."}`,
            },
          ],
          details: { theme },
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to generate theme: ${String(err)}` }],
          details: undefined,
        };
      }
    },
  };
}
