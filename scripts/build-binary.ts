/**
 * Build script for creating a single-file executable with embedded frontend
 * 
 * Usage: bun run scripts/build-binary.ts
 * Output: ./friend-server (single executable)
 */

import { join, resolve } from "node:path";
import { writeFileSync } from "node:fs";

const ROOT = resolve(import.meta.dir, "..");
const SERVER_INDEX = join(ROOT, "packages/server/src/index.ts");
const OUTPUT = join(ROOT, "friend-server");

console.log("🔨 Building single-file executable...\n");

// Step 1: Generate embedded assets (by importing the script)
console.log("📝 Generating embedded assets...");
await import("./generate-assets.ts");

// Step 2: Build the binary
console.log("🚀 Compiling binary...");
const result = await Bun.build({
  entrypoints: [SERVER_INDEX],
  compile: {
    outfile: OUTPUT,
  },
});

if (!result.success) {
  console.error("❌ Build failed:");
  for (const error of result.logs) {
    console.error(error);
  }
  process.exit(1);
}

// Step 3: Create package.json for runtime (needed by pi-coding-agent)
const packageJson = {
  name: "friend-server",
  version: "0.1.0",
  piConfig: {
    name: "friend",
    configDir: ".friend",
  },
};

const packageJsonPath = join(ROOT, "package.embedded.json");
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log("📝 Created package.embedded.json");

// Step 4: Done!
const stats = await Bun.file(OUTPUT).stat();
const sizeMB = (stats.size / 1024 / 1024).toFixed(1);

console.log(`\n✅ Build complete!
   Binary: ${OUTPUT}
   Size: ${sizeMB}MB
   
   Usage: 
     cp friend-server ~/bin/
     cp package.embedded.json ~/bin/package.json
     ~/bin/friend-server
`);
