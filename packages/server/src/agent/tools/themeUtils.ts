import type { ThemeConfig, ThemeMode } from "@friend/shared";
import { BUILT_IN_THEMES } from "@friend/shared";

export function getAllBuiltInThemes(): ThemeConfig[] {
  return [...BUILT_IN_THEMES];
}

export function generateThemeFromColor(
  baseColor: { h: number; c: number },
  mode: ThemeMode,
  name?: string,
): ThemeConfig {
  const isDark = mode === "dark";
  const bgL = isDark ? 0.145 : 0.96;
  const fgL = isDark ? 0.95 : 0.15;

  const theme: ThemeConfig = {
    id: `generated-${baseColor.h}-${Date.now().toString(36)}`,
    name: name || `Generated Theme (${baseColor.h})`,
    mode,
    isPreset: false,
    isBuiltIn: false,
    colors: {
      background: { l: bgL, c: 0, h: 0 },
      foreground: { l: fgL, c: 0, h: 0 },
      card: { l: isDark ? bgL + 0.035 : bgL + 0.02, c: 0, h: 0 },
      cardForeground: { l: fgL, c: 0, h: 0 },
      popover: { l: isDark ? bgL + 0.035 : bgL + 0.02, c: 0, h: 0 },
      popoverForeground: { l: fgL, c: 0, h: 0 },
      primary: { l: isDark ? 0.72 : 0.5, c: baseColor.c, h: baseColor.h },
      primaryForeground: { l: bgL, c: 0, h: 0 },
      secondary: { l: isDark ? 0.27 : 0.88, c: baseColor.c * 0.3, h: baseColor.h },
      secondaryForeground: { l: fgL, c: 0, h: 0 },
      muted: { l: isDark ? 0.27 : 0.88, c: baseColor.c * 0.2, h: baseColor.h },
      mutedForeground: { l: isDark ? 0.65 : 0.5, c: baseColor.c * 0.15, h: baseColor.h },
      accent: {
        l: isDark ? 0.6 : 0.65,
        c: Math.min(baseColor.c * 1.5, 0.25),
        h: (baseColor.h + 10) % 360,
      },
      accentForeground: { l: bgL, c: 0, h: 0 },
      destructive: { l: 0.58, c: 0.18, h: 25 },
      destructiveForeground: { l: fgL, c: 0, h: 0 },
      border: { l: isDark ? 0.27 : 0.88, c: baseColor.c * 0.2, h: baseColor.h },
      input: { l: isDark ? 0.27 : 0.88, c: baseColor.c * 0.2, h: baseColor.h },
      ring: {
        l: isDark ? 0.55 : 0.5,
        c: Math.min(baseColor.c * 1.3, 0.2),
        h: (baseColor.h + 5) % 360,
      },
      sidebar: { l: bgL, c: 0, h: 0 },
      sidebarForeground: { l: fgL, c: 0, h: 0 },
      sidebarBorder: { l: isDark ? 0.27 : 0.88, c: baseColor.c * 0.2, h: baseColor.h },
    },
  };

  return theme;
}
