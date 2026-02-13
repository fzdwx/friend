import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GLOBAL_AGENTS_MD_PATH } from "./paths.js";
import defaultAgentsMd from "./defaults/AGENTS.txt";
import defaultBootstrapMd from "./defaults/BOOTSTRAP.txt";
import defaultIdentityMd from "./defaults/IDENTITY.txt";
import defaultUserMd from "./defaults/USER.txt";
import defaultSoulMd from "./defaults/SOUL.txt";
import defaultToolsMd from "./defaults/TOOLS.txt";
import defaultHeartbeatMd from "./defaults/HEARTBEAT.txt";

/**
 * Write a default file on first run.
 * Uses `wx` flag — no-op if file already exists.
 */
async function ensureDefaultFile(targetPath: string, content: string): Promise<void> {
  try {
    await writeFile(targetPath, content, { flag: "wx" });
  } catch (err: any) {
    if (err.code !== "EEXIST") throw err;
  }
}

/** Seed global AGENTS.md into APP_CONFIG_DIR */
export async function ensureDefaults(): Promise<void> {
  await ensureDefaultFile(GLOBAL_AGENTS_MD_PATH, defaultAgentsMd);
}

/** Seed workspace context files into {cwd}/.friend/ */
export async function ensureProjectDefaults(cwd: string): Promise<void> {
  const friendDir = join(cwd, ".friend");
  await mkdir(friendDir, { recursive: true });

  await Promise.all([
    ensureDefaultFile(join(friendDir, "BOOTSTRAP.md"), defaultBootstrapMd),
    ensureDefaultFile(join(friendDir, "IDENTITY.md"), defaultIdentityMd),
    ensureDefaultFile(join(friendDir, "USER.md"), defaultUserMd),
    ensureDefaultFile(join(friendDir, "SOUL.md"), defaultSoulMd),
    ensureDefaultFile(join(friendDir, "TOOLS.md"), defaultToolsMd),
    ensureDefaultFile(join(friendDir, "HEARTBEAT.md"), defaultHeartbeatMd),
  ]);
}
