/**
 * Generate a stub generated-assets.ts for development mode.
 * Used by `just setup` when the file doesn't exist yet.
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const OUTPUT = join(ROOT, "packages/server/src/generated-assets.ts");

const stub = `\
export const embeddedAssets: Record<string, string> = {};
export function hasEmbeddedAssets(): boolean { return false; }
export function getEmbeddedAsset(path: string): string | null { return null; }
export function listEmbeddedAssets(): string[] { return []; }
`;

writeFileSync(OUTPUT, stub);
console.log("[setup] Created generated-assets stub:", OUTPUT);
