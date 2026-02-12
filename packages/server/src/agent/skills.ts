import { watch, type FSWatcher } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { GLOBAL_SKILLS_DIR } from "./paths.js";

export { GLOBAL_SKILLS_DIR };
const PROJECT_SKILLS_DIR_NAME = ".friend/skills";

export function getProjectSkillsDir(cwd: string): string {
  return join(cwd, PROJECT_SKILLS_DIR_NAME);
}

export async function ensureSkillsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true }).catch(() => {});
}

export class SkillWatcher {
  private globalWatcher: FSWatcher | null = null;
  private projectWatchers = new Map<string, FSWatcher>();
  private debounceTimers = new Map<string, Timer>();

  constructor(private onReload: (scope: "global" | string) => void) {}

  start(): void {
    this.watchDir(GLOBAL_SKILLS_DIR, "global");
  }

  watchProject(cwd: string): void {
    if (this.projectWatchers.has(cwd)) return;
    const dir = getProjectSkillsDir(cwd);
    this.watchDir(dir, cwd);
  }

  unwatchProject(cwd: string): void {
    const watcher = this.projectWatchers.get(cwd);
    if (watcher) {
      watcher.close();
      this.projectWatchers.delete(cwd);
    }
    const timer = this.debounceTimers.get(cwd);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(cwd);
    }
  }

  dispose(): void {
    this.globalWatcher?.close();
    this.globalWatcher = null;
    for (const watcher of this.projectWatchers.values()) watcher.close();
    this.projectWatchers.clear();
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
  }

  private watchDir(dir: string, scope: "global" | string): void {
    ensureSkillsDir(dir)
      .then(() => {
        try {
          const watcher = watch(dir, { recursive: true }, () => {
            this.debounce(scope);
          });
          if (scope === "global") {
            this.globalWatcher = watcher;
          } else {
            this.projectWatchers.set(scope, watcher);
          }
        } catch {
          // Directory may not be watchable; skip silently
        }
      })
      .catch(() => {
        // Failed to create directory; skip silently
      });
  }

  private debounce(scope: "global" | string): void {
    const existing = this.debounceTimers.get(scope);
    if (existing) clearTimeout(existing);
    this.debounceTimers.set(
      scope,
      setTimeout(() => {
        this.debounceTimers.delete(scope);
        this.onReload(scope);
      }, 300),
    );
  }
}
