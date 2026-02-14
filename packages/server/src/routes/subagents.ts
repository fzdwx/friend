/**
 * Subagent management routes
 * 
 * Provides CRUD operations for subagent definitions
 */

import { Elysia, t } from "elysia";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { discoverSubagents, clearCache } from "../agent/subagents/discovery.js";
import type { SubagentConfig } from "../agent/subagents/types.js";

// ─── Paths ─────────────────────────────────────────────────────────

function getUserSubagentsDir(): string {
  return join(homedir(), ".config", "friend", "subagents");
}

// ─── Routes ─────────────────────────────────────────────────────────

export const subagentRoutes = new Elysia({ prefix: "/api/subagents" })
  // List all subagents
  .get(
    "/",
    ({ query }) => {
      try {
        const workspacePath = query.workspace as string | undefined;
        const scope = (query.scope as "user" | "workspace" | "both") || "user";
        
        const discovery = discoverSubagents(workspacePath, scope);
        
        return {
          ok: true,
          data: discovery.agents,
          workspaceAgentsDir: discovery.workspaceAgentsDir,
        };
      } catch (error) {
        console.error("[SubagentsAPI] Error listing subagents:", error);
        return {
          ok: false,
          error: "Failed to list subagents",
        };
      }
    },
    {
      query: t.Object({
        workspace: t.Optional(t.String()),
        scope: t.Optional(t.String()),
      }),
    },
  )

  // Get single subagent by name
  .get(
    "/:name",
    ({ params, query }) => {
      try {
        const { name } = params;
        const workspacePath = query.workspace as string | undefined;
        const scope = (query.scope as "user" | "workspace" | "both") || "user";
        
        const discovery = discoverSubagents(workspacePath, scope);
        const agent = discovery.agents.find(a => a.name === name);
        
        if (!agent) {
          return {
            ok: false,
            error: `Subagent '${name}' not found`,
          };
        }
        
        return {
          ok: true,
          data: agent,
        };
      } catch (error) {
        console.error("[SubagentsAPI] Error getting subagent:", error);
        return {
          ok: false,
          error: "Failed to get subagent",
        };
      }
    },
    {
      params: t.Object({
        name: t.String(),
      }),
      query: t.Object({
        workspace: t.Optional(t.String()),
        scope: t.Optional(t.String()),
      }),
    },
  )

  // Create new subagent
  .post(
    "/",
    async ({ body }) => {
      try {
        const { name, description, tools, model, systemPrompt } = body;
        
        if (!name || !description || !systemPrompt) {
          return {
            ok: false,
            error: "Missing required fields: name, description, systemPrompt",
          };
        }
        
        // Validate name (alphanumeric, dashes, underscores)
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
          return {
            ok: false,
            error: "Name must contain only alphanumeric characters, dashes, and underscores",
          };
        }
        
        const userDir = getUserSubagentsDir();
        const filePath = join(userDir, `${name}.md`);
        
        // Check if already exists
        try {
          await fs.access(filePath);
          return {
            ok: false,
            error: `Subagent '${name}' already exists`,
          };
        } catch {
          // File doesn't exist, proceed
        }
        
        // Build frontmatter
        const frontmatter: string[] = [
          "---",
          `name: ${name}`,
          `description: ${description}`,
        ];
        
        if (tools && tools.length > 0) {
          frontmatter.push(`tools: ${tools.join(", ")}`);
        }
        
        if (model) {
          frontmatter.push(`model: ${model}`);
        }
        
        frontmatter.push("---");
        
        // Build complete file content
        const content = `${frontmatter.join("\n")}\n\n${systemPrompt}`;
        
        // Ensure directory exists
        await fs.mkdir(userDir, { recursive: true });
        
        // Write file
        await fs.writeFile(filePath, content, "utf-8");
        
        // Clear cache to pick up new subagent
        clearCache();
        
        return {
          ok: true,
          data: {
            name,
            description,
            tools,
            model,
            systemPrompt,
            source: "user",
            filePath,
          },
        };
      } catch (error) {
        console.error("[SubagentsAPI] Error creating subagent:", error);
        return {
          ok: false,
          error: "Failed to create subagent",
        };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.String(),
        tools: t.Optional(t.Array(t.String())),
        model: t.Optional(t.String()),
        systemPrompt: t.String(),
      }),
    },
  )

  // Update existing subagent
  .put(
    "/:name",
    async ({ params, body }) => {
      try {
        const { name } = params;
        const { description, tools, model, systemPrompt } = body;
        
        const userDir = getUserSubagentsDir();
        const filePath = join(userDir, `${name}.md`);
        
        // Check if exists
        try {
          await fs.access(filePath);
        } catch {
          return {
            ok: false,
            error: `Subagent '${name}' not found`,
          };
        }
        
        // Build frontmatter
        const frontmatter: string[] = [
          "---",
          `name: ${name}`,
        ];
        
        if (description) {
          frontmatter.push(`description: ${description}`);
        }
        
        if (tools && tools.length > 0) {
          frontmatter.push(`tools: ${tools.join(", ")}`);
        }
        
        if (model) {
          frontmatter.push(`model: ${model}`);
        }
        
        frontmatter.push("---");
        
        // Build complete file content
        const content = `${frontmatter.join("\n")}\n\n${systemPrompt || ""}`;
        
        // Write file
        await fs.writeFile(filePath, content, "utf-8");
        
        // Clear cache to pick up changes
        clearCache();
        
        return {
          ok: true,
          data: {
            name,
            description,
            tools,
            model,
            systemPrompt,
            source: "user",
            filePath,
          },
        };
      } catch (error) {
        console.error("[SubagentsAPI] Error updating subagent:", error);
        return {
          ok: false,
          error: "Failed to update subagent",
        };
      }
    },
    {
      params: t.Object({
        name: t.String(),
      }),
      body: t.Object({
        description: t.Optional(t.String()),
        tools: t.Optional(t.Array(t.String())),
        model: t.Optional(t.String()),
        systemPrompt: t.Optional(t.String()),
      }),
    },
  )

  // Delete subagent
  .delete(
    "/:name",
    async ({ params }) => {
      try {
        const { name } = params;
        
        const userDir = getUserSubagentsDir();
        const filePath = join(userDir, `${name}.md`);
        
        // Check if exists
        try {
          await fs.access(filePath);
        } catch {
          return {
            ok: false,
            error: `Subagent '${name}' not found`,
          };
        }
        
        // Delete file
        await fs.unlink(filePath);
        
        // Clear cache
        clearCache();
        
        return {
          ok: true,
          message: `Subagent '${name}' deleted`,
        };
      } catch (error) {
        console.error("[SubagentsAPI] Error deleting subagent:", error);
        return {
          ok: false,
          error: "Failed to delete subagent",
        };
      }
    },
    {
      params: t.Object({
        name: t.String(),
      }),
    },
  );
