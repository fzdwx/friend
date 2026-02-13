import { watch, type FSWatcher } from "node:fs";
import { mkdir } from "node:fs/promises";
import { GLOBAL_SKILLS_DIR } from "./paths.js";

export { GLOBAL_SKILLS_DIR };

export async function ensureSkillsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true }).catch(() => {});
}

export class SkillWatcher {
  private globalWatcher: FSWatcher | null = null;
  private debounceTimer: Timer | null = null;

  constructor(private onReload: () => void) {}

  start(): void {
    this.watchDir(GLOBAL_SKILLS_DIR);
  }

  dispose(): void {
    this.globalWatcher?.close();
    this.globalWatcher = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private watchDir(dir: string): void {
    ensureSkillsDir(dir)
      .then(() => {
        try {
          this.globalWatcher = watch(dir, { recursive: true }, () => {
            this.debounce();
          });
        } catch {
          // Directory may not be watchable; skip silently
        }
      })
      .catch(() => {
        // Failed to create directory; skip silently
      });
  }

  private debounce(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.onReload();
    }, 300);
  }
}
