/**
 * Theme Manager
 * 
 * Handles theme management and persistence.
 */

import { prisma } from "@friend/db";
import type { ThemeConfig } from "@friend/shared";
import { BUILT_IN_THEMES } from "@friend/shared";
import type { IThemeManager, ThemeManagerDeps } from "./types.js";

export class ThemeManager implements IThemeManager {
  private activeThemeId: string = "default-dark";
  private readonly deps: ThemeManagerDeps;

  constructor(deps: ThemeManagerDeps) {
    this.deps = deps;
  }

  setActiveThemeId(id: string): void {
    this.activeThemeId = id;
  }

  getActiveThemeId(): string {
    return this.activeThemeId;
  }

  async setActiveTheme(themeId: string): Promise<void> {
    this.activeThemeId = themeId;
    await prisma.appConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", activeThemeId: themeId },
      update: { activeThemeId: themeId },
    });
    this.deps.broadcastGlobal({ type: "config_updated", activeThemeId: themeId });
  }

  private async getCustomThemes(): Promise<ThemeConfig[]> {
    const rows = await prisma.customTheme.findMany({ orderBy: { updatedAt: "desc" } });
    return rows.map((ct) => ({
      id: ct.id,
      name: ct.name,
      mode: ct.mode as "light" | "dark" | "system",
      isPreset: false,
      isBuiltIn: false,
      colors: JSON.parse(ct.colors),
    }));
  }

  async getThemes(): Promise<ThemeConfig[]> {
    const custom = await this.getCustomThemes();
    return [...BUILT_IN_THEMES, ...custom];
  }

  async addCustomTheme(theme: ThemeConfig): Promise<ThemeConfig> {
    await prisma.customTheme.create({
      data: {
        id: theme.id,
        name: theme.name,
        mode: theme.mode,
        colors: JSON.stringify(theme.colors),
      },
    });
    this.deps.broadcastGlobal({ type: "config_updated", addedTheme: theme });
    return theme;
  }

  async updateCustomTheme(
    themeId: string,
    updates: Partial<ThemeConfig>,
  ): Promise<ThemeConfig | null> {
    const existing = await prisma.customTheme.findUnique({ where: { id: themeId } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (updates.name) data.name = updates.name;
    if (updates.mode) data.mode = updates.mode;
    if (updates.colors) data.colors = JSON.stringify(updates.colors);

    await prisma.customTheme.update({ where: { id: themeId }, data });

    const updated: ThemeConfig = {
      id: existing.id,
      name: updates.name ?? existing.name,
      mode: (updates.mode ?? existing.mode) as "light" | "dark" | "system",
      isPreset: false,
      isBuiltIn: false,
      colors: updates.colors ?? JSON.parse(existing.colors),
    };
    this.deps.broadcastGlobal({ type: "config_updated", updatedTheme: updated });
    return updated;
  }

  async deleteCustomTheme(themeId: string): Promise<boolean> {
    const existing = await prisma.customTheme.findUnique({ where: { id: themeId } });
    if (!existing) return false;
    await prisma.customTheme.delete({ where: { id: themeId } });

    // If deleted theme was active, reset to default
    if (this.activeThemeId === themeId) {
      this.activeThemeId = "default-dark";
      await prisma.appConfig.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", activeThemeId: "default-dark" },
        update: { activeThemeId: "default-dark" },
      });
    }
    this.deps.broadcastGlobal({ type: "config_updated", deletedThemeId: themeId });
    return true;
  }
}
