#!/usr/bin/env bun

/**
 * Build script for creating a release package
 * 
 * Output: release/
 *   - apex-server  (binary)
 *   - web/           (frontend assets)
 */

import { $ } from "bun";
import { existsSync, statSync, cpSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const APP_DIST = join(ROOT, "packages/app/dist");
const RELEASE_DIR = join(ROOT, "release");

console.log("🔨 Building Friend release package...\n");

// Step 1: Build frontend if needed
if (!existsSync(APP_DIST)) {
  console.log("📦 Building frontend...");
  await $`cd ${join(ROOT, "packages/app")} && bun run build`.quiet();
}
console.log(`✅ Frontend: ${APP_DIST}`);

// Step 2: Build binary
console.log("🚀 Compiling binary...");
await $`cd ${join(ROOT, "packages/server")} && bun build src/index.ts --compile --outfile=${join(RELEASE_DIR, "apex-server")}`.quiet();
console.log("✅ Binary compiled");

// Step 3: Copy frontend to release/web
console.log("📦 Copying frontend assets...");
const webDir = join(RELEASE_DIR, "web");
if (existsSync(webDir)) rmSync(webDir, { recursive: true });
cpSync(APP_DIST, webDir, { recursive: true });
console.log(`✅ Frontend copied to: ${webDir}`);

// Step 4: Print summary
const binarySize = Math.round(statSync(join(RELEASE_DIR, "apex-server")).size / 1024 / 1024);

console.log(`\n✅ Release package ready!
   ${RELEASE_DIR}/
   ├── apex-server  (${binarySize}MB)
   └── web/           (frontend assets)
   
   Usage: ./apex-server
`);
