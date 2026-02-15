/**
 * File system routes for browsing and viewing files
 */

import { Elysia, t } from "elysia";
import { getAgentManager } from "../agent/manager.js";
import { readdir, stat, readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { existsSync } from "node:fs";

interface FileTreeItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: Date;
}

interface FileContent {
  path: string;
  name: string;
  content: string;
  size: number;
  modified: Date;
  language: string;
}

// Map file extensions to language identifiers for syntax highlighting
const extToLanguage: Record<string, string> = {
  // JavaScript/TypeScript
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  mjs: "javascript",
  cjs: "javascript",

  // Web
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",

  // Data formats
  json: "json",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",

  // Documentation
  md: "markdown",
  mdx: "mdx",

  // Programming languages
  py: "python",
  pyx: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  php: "php",
  cs: "csharp",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  swift: "swift",
  m: "objectivec",
  mm: "objectivec",
  dart: "dart",
  lua: "lua",
  pl: "perl",
  r: "r",
  jl: "julia",
  hs: "haskell",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  clj: "clojure",
  cljs: "clojure",
  vim: "vim",
  vimscript: "vim",

  // Shell
  sh: "bash",
  bash: "bash",
  zsh: "zsh",
  fish: "fish",
  ps1: "powershell",

  // Config
  env: "dotenv",
  gitignore: "gitignore",
  dockerignore: "dockerignore",

  // Other
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  proto: "protobuf",
  prisma: "prisma",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  dockerfile: "dockerfile",
  makefile: "makefile",
  cmake: "cmake",
  log: "log",
  txt: "text",
};

// Get language from file path
function getLanguageFromPath(path: string): string {
  const ext = extname(path).toLowerCase().slice(1);
  
  // Check for special filenames
  const filename = basename(path).toLowerCase();
  if (filename === "dockerfile") return "dockerfile";
  if (filename === "makefile") return "makefile";
  if (filename === "cmakelists.txt") return "cmake";
  if (filename === ".gitignore") return "gitignore";
  if (filename === ".dockerignore") return "dockerignore";
  if (filename.startsWith(".env")) return "dotenv";
  
  return extToLanguage[ext] || "text";
}

// Check if file is a text file (should be viewable)
function isTextFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase().slice(1);
  
  // Common binary extensions to skip
  const binaryExtensions = new Set([
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg",
    "mp3", "mp4", "wav", "avi", "mov", "webm", "flac",
    "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
    "zip", "tar", "gz", "rar", "7z", "bz2",
    "exe", "dll", "so", "dylib",
    "node_modules", "lock", "package-lock.json",
  ]);
  
  // Special files that are text
  const textFiles = new Set([
    "lock", // package-lock.json, yarn.lock, etc. - viewable
  ]);
  
  if (binaryExtensions.has(ext) && !textFiles.has(ext)) {
    return false;
  }
  
  return true;
}

// Get session working directory, default to process.cwd()
async function getSessionWorkingPath(sessionId: string): Promise<string> {
  const session = await getAgentManager().getSession(sessionId);
  return session?.workingPath ?? process.cwd();
}

export const fileRoutes = new Elysia({ prefix: "/api/files" })

  // ─── Get File Tree ─────────────────────────────────────────
  .get("/tree", async ({ query }) => {
    const { sessionId, path: relativePath = "." } = query;
    
    try {
      const workingPath = await getSessionWorkingPath(sessionId);

      const fullPath = join(workingPath, relativePath);
      
      if (!existsSync(fullPath)) {
        return { ok: false, error: "Directory not found" };
      }

      const entries = await readdir(fullPath, { withFileTypes: true });
      
      const items: FileTreeItem[] = await Promise.all(
        entries
          .filter(entry => {
            // Skip hidden files and common ignore patterns
            if (entry.name.startsWith(".")) {
              // Allow .env, .gitignore, etc.
              const allowed = [".env", ".gitignore", ".dockerignore", ".editorconfig", ".prettierrc", ".eslintrc"];
              return allowed.some(allowed => entry.name.startsWith(allowed));
            }
            // Skip node_modules
            if (entry.name === "node_modules") return false;
            // Skip .git directory
            if (entry.name === ".git") return false;
            return true;
          })
          .map(async entry => {
            const itemPath = relativePath === "." ? entry.name : join(relativePath, entry.name);
            const stats = await stat(join(fullPath, entry.name));
            
            return {
              name: entry.name,
              path: itemPath,
              type: entry.isDirectory() ? "directory" : "file",
              size: stats.size,
              modified: stats.mtime,
            };
          })
      );

      // Sort: directories first, then by name
      items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return { ok: true, data: items };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, {
    query: t.Object({
      sessionId: t.String(),
      path: t.Optional(t.String()),
    }),
  })

  // ─── Get File Content ───────────────────────────────────────
  .get("/content", async ({ query }) => {
    const { sessionId, path: relativePath } = query;
    
    try {
      const workingPath = await getSessionWorkingPath(sessionId);

      const fullPath = join(workingPath, relativePath);
      
      if (!existsSync(fullPath)) {
        return { ok: false, error: "File not found" };
      }

      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        return { ok: false, error: "Path is a directory, not a file" };
      }

      // Check if it's a text file
      const filename = basename(relativePath);
      if (!isTextFile(filename)) {
        return { ok: false, error: "Binary file, cannot display" };
      }

      // Limit file size to 5MB
      const maxSize = 5 * 1024 * 1024;
      if (stats.size > maxSize) {
        return { ok: false, error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB), max is 5MB` };
      }

      const content = await readFile(fullPath, "utf-8");
      
      const fileData: FileContent = {
        path: relativePath,
        name: filename,
        content,
        size: stats.size,
        modified: stats.mtime,
        language: getLanguageFromPath(relativePath),
      };

      return { ok: true, data: fileData };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, {
    query: t.Object({
      sessionId: t.String(),
      path: t.String(),
    }),
  })

  // ─── Search Files ───────────────────────────────────────────
  .get("/search", async ({ query }) => {
    const { sessionId, pattern } = query;
    
    try {
      const workingPath = await getSessionWorkingPath(sessionId);

      // Use Bun's built-in Glob (available globally in Bun runtime)
      const globPattern = new (globalThis as any).Glob(pattern);
      const files: string[] = [];
      
      for await (const file of globPattern.scan({
        cwd: workingPath,
        onlyFiles: true,
        dot: false,
      })) {
        // Skip ignored directories
        if (file.includes("node_modules/") || 
            file.includes(".git/") || 
            file.includes("dist/") || 
            file.includes("build/") ||
            file.includes(".next/") ||
            file.includes(".nuxt/")) {
          continue;
        }
        files.push(file);
        if (files.length >= 100) break; // Limit results
      }

      // Get stats for each file
      const results = await Promise.all(
        files.map(async (file: string) => {
          try {
            const stats = await stat(join(workingPath, file));
            return {
              path: file,
              name: basename(file),
              size: stats.size,
              modified: stats.mtime,
              language: getLanguageFromPath(file),
            };
          } catch {
            return null;
          }
        })
      );

      const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);

      return { ok: true, data: validResults };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, {
    query: t.Object({
      sessionId: t.String(),
      pattern: t.String(),
    }),
  });
