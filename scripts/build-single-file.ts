#!/usr/bin/env bun

/**
 * Build script for creating a single-file executable
 * 
 * Technique: Append assets to the binary, read at runtime
 * 
 * Binary structure:
 * [ELF/Mach-O executable] [ASSET_MARKER] [asset_count: 4 bytes] [assets...]
 */

import { $ } from "bun";
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync, openSync, fstatSync, closeSync, readSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const APP_DIST = join(ROOT, "packages/app/dist");
const SERVER_SRC = join(ROOT, "packages/server/src");
const TEMP_BINARY = join(ROOT, "apex-server-temp");
const FINAL_BINARY = join(ROOT, "apex-server");

const ASSET_MARKER = Buffer.from("FRND_ASSETS");

console.log("🔨 Building single-file executable...\n");

// Step 1: Build frontend if needed
if (!existsSync(APP_DIST)) {
  console.log("📦 Building frontend...");
  await $`cd ${join(ROOT, "packages/app")} && bun run build`.quiet();
}

// Step 2: Build binary
console.log("🚀 Compiling binary...");
await $`cd ${join(ROOT, "packages/server")} && bun build src/index.ts --compile --outfile=${TEMP_BINARY}`.quiet();

// Step 3: Collect assets
interface Asset {
  path: string;
  size: number;
  offset: number;
}

function collectFiles(dir: string, baseDir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else {
      files.push(relative(baseDir, fullPath));
    }
  }
  
  return files;
}

console.log("📦 Collecting assets...");
const files = collectFiles(APP_DIST, APP_DIST);
console.log(`   Found ${files.length} files`);

// Step 4: Create asset index
const assets: Asset[] = [];
let offset = 0;

for (const file of files) {
  const filePath = join(APP_DIST, file);
  const stat = statSync(filePath);
  assets.push({
    path: "/" + file.replace(/\\/g, "/"),
    size: stat.size,
    offset,
  });
  offset += stat.size;
}

// Step 5: Append assets to binary
console.log("📦 Appending assets to binary...");

const binaryFd = openSync(TEMP_BINARY, "r");
const binaryStat = fstatSync(binaryFd);
const binarySize = binaryStat.size;
const binaryData = Buffer.alloc(binarySize);
readSync(binaryFd, binaryData, 0, binarySize, 0);
closeSync(binaryFd);

// Create asset data buffer
const assetDataSize = assets.reduce((sum, a) => sum + a.size, 0);
const assetData = Buffer.alloc(assetDataSize);
let writeOffset = 0;

for (const asset of assets) {
  const filePath = join(APP_DIST, asset.path.substring(1));
  const data = readFileSync(filePath);
  data.copy(assetData, writeOffset);
  writeOffset += asset.size;
}

// Create index JSON
const indexJson = JSON.stringify({ assets, binarySize });
const indexBuffer = Buffer.from(indexJson, "utf8");

// Build final binary
const finalFd = openSync(FINAL_BINARY, "w");

// Write original binary
writeFileSync(FINAL_BINARY, binaryData);

// Append marker
const fd = openSync(FINAL_BINARY, "a");
writeSync(fd, ASSET_MARKER);

// Append index size (4 bytes)
const indexSizeBuffer = Buffer.alloc(4);
indexSizeBuffer.writeUInt32BE(indexBuffer.length, 0);
writeSync(fd, indexSizeBuffer);

// Append index
writeSync(fd, indexBuffer);

// Append assets
writeSync(fd, assetData);

closeSync(fd);

// Clean up temp
rmSync(TEMP_BINARY);

// Done
const finalSize = Math.round(statSync(FINAL_BINARY).size / 1024 / 1024);
console.log(`\n✅ Build complete!
   Binary: ${FINAL_BINARY}
   Size: ${finalSize}MB
   Assets: ${files.length} files embedded
   
   Usage: ./apex-server
`);

// Helper for sync write
function writeSync(fd: number, data: Buffer) {
  const written = Bun.writeSync(fd, data);
  return written;
}
