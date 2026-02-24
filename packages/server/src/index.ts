// ─── Binary Runtime Setup ────────────────────────────────────────────────
// MUST be done BEFORE any imports that use @mariozechner/pi-coding-agent
// The SDK reads package.json at module load time via getPackageJsonPath()
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// For compiled binaries, we need to provide a package.json for the SDK
// The SDK uses PI_PACKAGE_DIR env var to locate it
if (!process.env.PI_PACKAGE_DIR) {
  // Check if we're running as a compiled binary (no package.json in cwd)
  const cwdPkgPath = join(process.cwd(), "package.json");
  if (!existsSync(cwdPkgPath)) {
    // Create a minimal package.json in a temp directory
    const tempDir = join(tmpdir(), "friend-runtime");
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    
    const tempPkgPath = join(tempDir, "package.json");
    if (!existsSync(tempPkgPath)) {
      const minimalPackage = {
        name: "friend-server",
        version: "1.0.0",
        description: "Friend AI Agent Server"
      };
      writeFileSync(tempPkgPath, JSON.stringify(minimalPackage, null, 2));
    }
    
    process.env.PI_PACKAGE_DIR = tempDir;
    console.log(`[Friend] Binary mode: PI_PACKAGE_DIR set to ${tempDir}`);
  }
}

// ─── Database Setup ────────────────────────────────────────────────────────
import { DB_PATH } from "./agent/paths.js";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${DB_PATH}`;
}

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { initAgentManager } from "./agent/manager";
import { ensureBuiltinSkills } from "./agent/builtin-skills/index.js";
import { sessionRoutes } from "./routes/sessions";
import { configRoutes } from "./routes/config";
import { eventRoutes } from "./routes/events";
import { modelRoutes } from "./routes/models";
import { skillRoutes } from "./routes/skills";
import { agentsRoutes, bindingsRoutes } from "./routes/agents.js";
import { fileRoutes } from "./routes/files.js";
import { cronRoutes } from "./routes/cron.js";
import { readdirSync, statSync } from "node:fs";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { embeddedAssets, hasEmbeddedAssets, listEmbeddedAssets } from "./generated-assets.js";

// Ensure built-in skills exist
ensureBuiltinSkills();

await initAgentManager();

// ─── Embedded Frontend Assets ─────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

// Check if we have embedded assets (from build)
const isEmbedded = hasEmbeddedAssets();

if (isEmbedded) {
  console.log(`[Friend] Embedded mode: ${listEmbeddedAssets().length} assets embedded`);
} else {
  console.log(`[Friend] Development mode`);
}

// ─── Create App ───────────────────────────────────────────────────────────

const app = new Elysia()
  .use(cors())
  // API Routes
  .use(sessionRoutes)
  .use(configRoutes)
  .use(eventRoutes)
  .use(modelRoutes)
  .use(skillRoutes)
  .use(agentsRoutes)
  .use(bindingsRoutes)
  .use(fileRoutes)
  .use(cronRoutes);

// ─── Serve Frontend ───────────────────────────────────────────────────────

if (isEmbedded) {
  // Serve embedded assets
  app.get("/assets/*", async ({ path }) => {
    const assetPath = path.slice(1); // Remove leading /
    const embeddedPath = embeddedAssets[assetPath];
    if (!embeddedPath) {
      return new Response("Not Found", { status: 404 });
    }
    return Bun.file(embeddedPath);
  });
  
  // Serve index.html for all other routes (SPA)
  app.get("/*", async ({ path }) => {
    // Skip API routes
    if (path.startsWith("/api")) {
      return new Response("Not Found", { status: 404 });
    }
    
    // Try to serve exact file
    const embeddedPath = embeddedAssets[path.slice(1)];
    if (embeddedPath) {
      return Bun.file(embeddedPath);
    }
    
    // Serve index.html for SPA routing
    const indexPath = embeddedAssets["index.html"];
    if (indexPath) {
      return Bun.file(indexPath);
    }
    
    return new Response("Not Found", { status: 404 });
  });
}

// ─── Start Server ─────────────────────────────────────────────────────────

app.listen(3001);

console.log(`\n  Friend server running at http://localhost:3001\n`);
if (!isEmbedded) {
  console.log(`  Frontend dev server at http://localhost:5173\n`);
}
