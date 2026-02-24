import { homedir, platform } from "node:os";
import { join } from "node:path";

function getAppConfigDir(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "apex");
    case "win32":
      return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "apex");
    default:
      return join(process.env.XDG_CONFIG_HOME ?? join(home, ".config"), "apex");
  }
}

export const APP_CONFIG_DIR = getAppConfigDir();
export const DB_PATH = join(APP_CONFIG_DIR, "apex.db");
export const SESSIONS_DIR = join(APP_CONFIG_DIR, "sessions");
export const GLOBAL_SKILLS_DIR = join(APP_CONFIG_DIR, "skills");
export const GLOBAL_MEMORY_DIR = join(APP_CONFIG_DIR, "memory");
