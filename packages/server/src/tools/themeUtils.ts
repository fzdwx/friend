import type { ThemeConfig, ColorSet, ThemeMode } from "@friend/shared";

// Built-in themes (same as frontend for consistency)
const BUILT_IN_THEMES: ThemeConfig[] = [
  {
    id: "default-light",
    name: "Default Light",
    mode: "light",
    isPreset: true,
    isBuiltIn: true,
    colors: {
      background: { l: 0.985, c: 0, h: 0 },
      foreground: { l: 0.145, c: 0, h: 0 },
      card: { l: 0.95, c: 0, h: 0 },
      cardForeground: { l: 0.145, c: 0, h: 0 },
      popover: { l: 0.95, c: 0, h: 0 },
      popoverForeground: { l: 0.145, c: 0, h: 0 },
      primary: { l: 0.5, c: 0, h: 0 },
      primaryForeground: { l: 0.985, c: 0, h: 0 },
      secondary: { l: 0.9, c: 0, h: 0 },
      secondaryForeground: { l: 0.5, c: 0, h: 0 },
      muted: { l: 0.9, c: 0, h: 0 },
      mutedForeground: { l: 0.5, c: 0, h: 0 },
      accent: { l: 0.9, c: 0, h: 0 },
      accentForeground: { l: 0.5, c: 0, h: 0 },
      destructive: { l: 0.6, c: 0.2, h: 25 },
      destructiveForeground: { l: 0.985, c: 0, h: 0 },
      border: { l: 0.9, c: 0, h: 0 },
      input: { l: 0.9, c: 0, h: 0 },
      ring: { l: 0.5, c: 0, h: 0 },
      sidebar: { l: 0.985, c: 0, h: 0 },
      sidebarForeground: { l: 0.145, c: 0, h: 0 },
      sidebarBorder: { l: 0.9, c: 0, h: 0 },
    },
  },
  {
    id: "default-dark",
    name: "Default Dark",
    mode: "dark",
    isPreset: true,
    isBuiltIn: true,
    colors: {
      background: { l: 0.145, c: 0, h: 0 },
      foreground: { l: 0.985, c: 0, h: 0 },
      card: { l: 0.178, c: 0, h: 0 },
      cardForeground: { l: 0.985, c: 0, h: 0 },
      popover: { l: 0.178, c: 0, h: 0 },
      popoverForeground: { l: 0.985, c: 0, h: 0 },
      primary: { l: 0.922, c: 0, h: 0 },
      primaryForeground: { l: 0.178, c: 0, h: 0 },
      secondary: { l: 0.269, c: 0, h: 0 },
      secondaryForeground: { l: 0.922, c: 0, h: 0 },
      muted: { l: 0.269, c: 0, h: 0 },
      mutedForeground: { l: 0.708, c: 0, h: 0 },
      accent: { l: 0.269, c: 0, h: 0 },
      accentForeground: { l: 0.922, c: 0, h: 0 },
      destructive: { l: 0.704, c: 0.191, h: 22.216 },
      destructiveForeground: { l: 0.922, c: 0, h: 0 },
      border: { l: 0.269, c: 0, h: 0 },
      input: { l: 0.269, c: 0, h: 0 },
      ring: { l: 0.556, c: 0, h: 0 },
      sidebar: { l: 0.145, c: 0, h: 0 },
      sidebarForeground: { l: 0.985, c: 0, h: 0 },
      sidebarBorder: { l: 0.269, c: 0, h: 0 },
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    mode: "dark",
    isPreset: true,
    isBuiltIn: true,
    colors: {
      background: { l: 0.12, c: 0, h: 0 },
      foreground: { l: 0.95, c: 0, h: 0 },
      card: { l: 0.15, c: 0, h: 0 },
      cardForeground: { l: 0.95, c: 0, h: 0 },
      popover: { l: 0.15, c: 0, h: 0 },
      popoverForeground: { l: 0.95, c: 0, h: 0 },
      primary: { l: 0.78, c: 0.12, h: 311 },
      primaryForeground: { l: 0.12, c: 0, h: 0 },
      secondary: { l: 0.25, c: 0.05, h: 285 },
      secondaryForeground: { l: 0.95, c: 0, h: 0 },
      muted: { l: 0.25, c: 0.05, h: 285 },
      mutedForeground: { l: 0.65, c: 0.05, h: 285 },
      accent: { l: 0.68, c: 0.18, h: 337 },
      accentForeground: { l: 0.12, c: 0, h: 0 },
      destructive: { l: 0.6, c: 0.18, h: 25 },
      destructiveForeground: { l: 0.95, c: 0, h: 0 },
      border: { l: 0.25, c: 0.05, h: 285 },
      input: { l: 0.25, c: 0.05, h: 285 },
      ring: { l: 0.68, c: 0.15, h: 337 },
      sidebar: { l: 0.12, c: 0, h: 0 },
      sidebarForeground: { l: 0.95, c: 0, h: 0 },
      sidebarBorder: { l: 0.25, c: 0.05, h: 285 },
    },
  },
];

// Generate a random color based on mode
function generateRandomColor(mode: ThemeMode): { l: number; c: number; h: number } {
  if (mode === "dark") {
    return {
      l: 0.1 + Math.random() * 0.3,
      c: Math.random() * 0.15,
      h: Math.floor(Math.random() * 360),
    };
  } else {
    return {
      l: 0.8 + Math.random() * 0.2,
      c: Math.random() * 0.1,
      h: Math.floor(Math.random() * 360),
    };
  }
}

// Generate a theme from a base color
export function generateThemeFromColor(
  baseColor: { h: number; c: number },
  mode: ThemeMode,
  name?: string,
): ThemeConfig {
  const isDark = mode === "dark";
  const bgL = isDark ? 0.1 + Math.random() * 0.1 : 0.9 + Math.random() * 0.1;
  const fgL = isDark ? 0.9 + Math.random() * 0.1 : 0.1 + Math.random() * 0.1;

  const theme: ThemeConfig = {
    id: `generated-${baseColor.h}-${Math.random().toString(36).substring(2, 6)}`,
    name: name || `Generated Theme (${baseColor.h}°)`,
    mode,
    isPreset: false,
    isBuiltIn: false,
    colors: {
      background: { l: bgL, c: 0, h: 0 },
      foreground: { l: fgL, c: 0, h: 0 },
      card: { l: isDark ? bgL + 0.03 : bgL - 0.03, c: 0, h: 0 },
      cardForeground: { l: fgL, c: 0, h: 0 },
      popover: { l: isDark ? bgL + 0.03 : bgL - 0.03, c: 0, h: 0 },
      popoverForeground: { l: fgL, c: 0, h: 0 },
      primary: { l: isDark ? 0.5 + Math.random() * 0.3 : 0.4 + Math.random() * 0.2, c: baseColor.c, h: baseColor.h },
      primaryForeground: { l: bgL, c: 0, h: 0 },
      secondary: { l: isDark ? 0.2 + Math.random() * 0.1 : 0.8 + Math.random() * 0.1, c: baseColor.c * 0.3, h: baseColor.h },
      secondaryForeground: { l: fgL, c: 0, h: 0 },
      muted: { l: isDark ? 0.25 + Math.random() * 0.05 : 0.75 + Math.random() * 0.1, c: baseColor.c * 0.2, h: baseColor.h },
      mutedForeground: { l: isDark ? 0.5 + Math.random() * 0.2 : 0.4 + Math.random() * 0.2, c: baseColor.c * 0.15, h: baseColor.h },
      accent: { l: isDark ? 0.4 + Math.random() * 0.3 : 0.5 + Math.random() * 0.2, c: Math.min(baseColor.c * 1.5, 0.25), h: baseColor.h + 10 },
      accentForeground: { l: bgL, c: 0, h: 0 },
      destructive: { l: 0.5 + Math.random() * 0.2, c: 0.15 + Math.random() * 0.1, h: 25 },
      destructiveForeground: { l: fgL, c: 0, h: 0 },
      border: { l: isDark ? 0.25 + Math.random() * 0.05 : 0.75 + Math.random() * 0.1, c: baseColor.c * 0.2, h: baseColor.h },
      input: { l: isDark ? 0.25 + Math.random() * 0.05 : 0.75 + Math.random() * 0.1, c: baseColor.c * 0.2, h: baseColor.h },
      ring: { l: isDark ? 0.4 + Math.random() * 0.2 : 0.5 + Math.random() * 0.2, c: Math.min(baseColor.c * 1.3, 0.2), h: baseColor.h + 5 },
      sidebar: { l: bgL, c: 0, h: 0 },
      sidebarForeground: { l: fgL, c: 0, h: 0 },
      sidebarBorder: { l: isDark ? 0.25 + Math.random() * 0.05 : 0.75 + Math.random() * 0.1, c: baseColor.c * 0.2, h: baseColor.h },
    },
  };

  return theme;
}

export function getAllBuiltInThemes(): ThemeConfig[] {
  return [...BUILT_IN_THEMES];
}
