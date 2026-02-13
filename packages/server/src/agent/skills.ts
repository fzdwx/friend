import { watch, type FSWatcher } from "node:fs";
import { mkdir } from "node:fs/promises";
import { GLOBAL_SKILLS_DIR } from "./paths.js";

export { GLOBAL_SKILLS_DIR };

export async function ensureSkillsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true }).catch(() => {});
}

/**
 * Callback when skills change
 * @param agentId - If set, only sessions using this agent should reload
 *                  If undefined, all sessions should reload (global change)
 */
export type SkillChangeCallback = (agentId?: string) => void;

/**
 * Watch for skill file changes
 *
 * Supports watching multiple directories:
 * - Global skills: ~/.config/friend/skills
 * - Agent skills: ~/.config/friend/agents/{agentId}/skills
 *
 * When a directory changes, the callback is invoked with the affected agentId.
 * Global changes invoke callback with undefined (all sessions should reload).
 */
export class SkillWatcher {
  private watchers = new Map<string, FSWatcher>();
  private debounceTimers = new Map<string, Timer>();

  constructor(private onChange: SkillChangeCallback) {}

  /**
   * Start watching global and agent skills directories
   * @param agentIds - List of agent IDs to watch (in addition to global)
   */
  start(agentIds: string[] = []): void {
    // Watch global skills
    this.watchDir(GLOBAL_SKILLS_DIR, undefined);

    // Watch each agent's skills
    for (const agentId of agentIds) {
      this.addAgentWatcher(agentId);
    }
  }

  /**
   * Add a watcher for an agent's skills directory
   */
  addAgentWatcher(agentId: string): void {
    const { resolveAgentSkillsDir } = require("./agent-manager.js");
    const agentSkillsDir = resolveAgentSkillsDir(agentId);
    this.watchDir(agentSkillsDir, agentId);
  }

  /**
   * Remove a watcher for an agent's skills directory
   */
  removeAgentWatcher(agentId: string): void {
    const { resolveAgentSkillsDir } = require("./agent-manager.js");
    const agentSkillsDir = resolveAgentSkillsDir(agentId);
    this.unwatchDir(agentSkillsDir);
  }

  /**
   * Update the list of agent watchers
   * Compares with current watchers and adds/removes as needed
   */
  updateAgentWatchers(agentIds: string[]): void {
    const { resolveAgentSkillsDir } = require("./agent-manager.js");

    // Get current agent directories being watched (skip global)
    const currentAgentDirs = new Map<string, string>();
    for (const [dir, agentId] of this.watcherAgentIds) {
      if (agentId) {
        currentAgentDirs.set(dir, agentId);
      }
    }

    // Build desired agent directories
    const desiredDirs = new Set<string>();
    for (const agentId of agentIds) {
      desiredDirs.add(resolveAgentSkillsDir(agentId));
    }

    // Remove watchers for directories no longer needed
    for (const [dir] of currentAgentDirs) {
      if (!desiredDirs.has(dir)) {
        this.unwatchDir(dir);
      }
    }

    // Add watchers for new directories
    for (const agentId of agentIds) {
      const dir = resolveAgentSkillsDir(agentId);
      if (!this.watchers.has(dir)) {
        this.watchDir(dir, agentId);
      }
    }
  }

  dispose(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Map from directory path to agentId (undefined for global)
   */
  private get watcherAgentIds(): Iterable<[string, string | undefined]> {
    const entries: [string, string | undefined][] = [];
    for (const [dir, watcher] of this.watchers) {
      // Extract agentId from directory path
      const agentId = this.getAgentIdFromDir(dir);
      entries.push([dir, agentId]);
    }
    return entries;
  }

  /**
   * Extract agentId from a skills directory path
   * Returns undefined for global skills directory
   */
  private getAgentIdFromDir(dir: string): string | undefined {
    if (dir === GLOBAL_SKILLS_DIR) {
      return undefined;
    }
    // Agent skills dir: ~/.config/friend/agents/{agentId}/skills
    const match = dir.match(/\/agents\/([^/]+)\/skills$/);
    return match ? match[1] : undefined;
  }

  private watchDir(dir: string, agentId: string | undefined): void {
    if (this.watchers.has(dir)) {
      return; // Already watching
    }

    ensureSkillsDir(dir)
      .then(() => {
        try {
          const watcher = watch(dir, { recursive: true }, () => {
            this.debounce(dir, agentId);
          });
          this.watchers.set(dir, watcher);
        } catch {
          // Directory may not be watchable; skip silently
        }
      })
      .catch(() => {
        // Failed to create directory; skip silently
      });
  }

  private unwatchDir(dir: string): void {
    const watcher = this.watchers.get(dir);
    if (watcher) {
      watcher.close();
      this.watchers.delete(dir);
    }

    const timer = this.debounceTimers.get(dir);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(dir);
    }
  }

  private debounce(dir: string, agentId: string | undefined): void {
    const existing = this.debounceTimers.get(dir);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      dir,
      setTimeout(() => {
        this.debounceTimers.delete(dir);
        this.onChange(agentId);
      }, 300),
    );
  }
}
