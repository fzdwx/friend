import type { ColorDefinition, ColorSet, Theme, ThemeMode, ThemeConfig } from "@friend/shared";

export function oklchToString(color: ColorDefinition): string {
  return `oklch(${color.l} ${color.c} ${color.h})`;
}

export function colorSetToVariables(colors: ColorSet): Record<string, string> {
  return {
    "--color-background": oklchToString(colors.background),
    "--color-foreground": oklchToString(colors.foreground),
    "--color-card": oklchToString(colors.card),
    "--color-card-foreground": oklchToString(colors.cardForeground),
    "--color-popover": oklchToString(colors.popover),
    "--color-popover-foreground": oklchToString(colors.popoverForeground),
    "--color-primary": oklchToString(colors.primary),
    "--color-primary-foreground": oklchToString(colors.primaryForeground),
    "--color-secondary": oklchToString(colors.secondary),
    "--color-secondary-foreground": oklchToString(colors.secondaryForeground),
    "--color-muted": oklchToString(colors.muted),
    "--color-muted-foreground": oklchToString(colors.mutedForeground),
    "--color-accent": oklchToString(colors.accent),
    "--color-accent-foreground": oklchToString(colors.accentForeground),
    "--color-destructive": oklchToString(colors.destructive),
    "--color-destructive-foreground": oklchToString(colors.destructiveForeground),
    "--color-border": oklchToString(colors.border),
    "--color-input": oklchToString(colors.input),
    "--color-ring": oklchToString(colors.ring),
    "--color-sidebar": oklchToString(colors.sidebar),
    "--color-sidebar-foreground": oklchToString(colors.sidebarForeground),
    "--color-sidebar-border": oklchToString(colors.sidebarBorder),
  };
}

export function applyThemeToDOM(theme: ThemeConfig): void {
  const html = document.documentElement;
  const variables = colorSetToVariables(theme.colors);

  for (const [key, value] of Object.entries(variables)) {
    html.style.setProperty(key, value);
  }
}

export function removeThemeFromDOM(): void {
  const html = document.documentElement;

  for (const key of Object.keys(colorSetToVariables({} as ColorSet))) {
    html.style.removeProperty(key);
  }
}

export function resolveThemeMode(mode: ThemeMode): Theme {
  if (mode !== "system") {
    return mode;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function hexToOklch(hex: string): ColorDefinition {
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 4) {
    r = Number.parseInt(hex[1] + hex[1], 16);
    g = Number.parseInt(hex[2] + hex[2], 16);
    b = Number.parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = Number.parseInt(hex.substring(1, 3), 16);
    g = Number.parseInt(hex.substring(3, 5), 16);
    b = Number.parseInt(hex.substring(5, 7), 16);
  }

  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;

  let c = 0;
  let h = 0;

  if (max !== min) {
    c = max - min;

    if (max === rNorm) {
      h = ((gNorm - bNorm) / c) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / c + 2;
    } else {
      h = (rNorm - gNorm) / c + 4;
    }

    h = h * 60;
    if (h < 0) h += 360;
  }

  return { l: Math.round(l * 100) / 100, c: Math.round(c * 100) / 100, h: Math.round(h) };
}

export function oklchToHex(color: ColorDefinition): string {
  const l = color.l;
  const c = color.c;
  const h = color.h;

  const hRad = (h * Math.PI) / 180;

  const a = Math.cos(hRad) * c;
  const b_ = Math.sin(hRad) * c;

  const L = l;
  let u = a;
  let v = b_;

  const thresh = 0.0031308;
  const k0 = 903.3;
  const k1 = 16;
  const k2 = 76.569;
  const k3 = 0.0500064;
  const k4 = 0.0743805;

  let r: number, g: number, b: number;

  const y = L <= 0.08 ? L * k3 : L * k2 + k4;
  const x = y * 2.03 + u * 4.59;
  const z = y * 1.11 - v * 2.97;

  const clip = (val: number) => Math.min(Math.max(val, 0), 1);

  const f = (val: number) => (val <= thresh ? val * k1 : val * (1 + k2) - k3);

  r = f(3.2406 * x - 1.5372 * y - 0.4986 * z);
  g = f(-0.9689 * x + 1.8758 * y + 0.0415 * z);
  b = f(0.0557 * x - 0.204 * y + 1.057 * z);

  const toHex = (val: number) => {
    const hex = Math.round(val * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function cloneColorSet(colors: ColorSet): ColorSet {
  return {
    background: { ...colors.background },
    foreground: { ...colors.foreground },
    card: { ...colors.card },
    cardForeground: { ...colors.cardForeground },
    popover: { ...colors.popover },
    popoverForeground: { ...colors.popoverForeground },
    primary: { ...colors.primary },
    primaryForeground: { ...colors.primaryForeground },
    secondary: { ...colors.secondary },
    secondaryForeground: { ...colors.secondaryForeground },
    muted: { ...colors.muted },
    mutedForeground: { ...colors.mutedForeground },
    accent: { ...colors.accent },
    accentForeground: { ...colors.accentForeground },
    destructive: { ...colors.destructive },
    destructiveForeground: { ...colors.destructiveForeground },
    border: { ...colors.border },
    input: { ...colors.input },
    ring: { ...colors.ring },
    sidebar: { ...colors.sidebar },
    sidebarForeground: { ...colors.sidebarForeground },
    sidebarBorder: { ...colors.sidebarBorder },
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
