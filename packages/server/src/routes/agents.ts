/**
 * Agent management routes
 */

import { Elysia, t } from "elysia";
import type { ThinkingLevel } from "@friend/shared";
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  resolveAgentConfig,
  resolveAgentWorkspaceDir,
  type AgentConfig,
} from "../agent/agent-manager.js";
import { loadWorkspaceFiles } from "../agent/context.js";
import { ensureAgentWorkspace } from "../agent/bootstrap.js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export const agentsRoutes = new Elysia({ prefix: "/api/agents" })

  // ─── List Agents ────────────────────────────────────────
  .get("/", async () => {
    const agents = await listAgents();
    return { 
      ok: true, 
      data: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        isDefault: agent.isDefault ?? false,
        identity: agent.identity,
        model: agent.model,
        thinkingLevel: agent.thinkingLevel,
        workspace: agent.workspace,
      }))
    };
  })

  // ─── Get Agent ──────────────────────────────────────────
  .get("/:id", async ({ params }) => {
    try {
      const agent = await getAgent(params.id);
      
      if (!agent) {
        return { ok: false, error: `Agent not found: ${params.id}` };
      }
      
      const resolved = await resolveAgentConfig(params.id);
      const workspaceDir = resolveAgentWorkspaceDir(params.id);
      
      // Get workspace stats
      let workspaceStats = {
        exists: false,
        path: workspaceDir,
        files: [] as string[],
        size: 0,
      };
      
      if (existsSync(workspaceDir)) {
        const files = await loadWorkspaceFiles(workspaceDir);
        workspaceStats = {
          exists: true,
          path: workspaceDir,
          files: files.map(f => f.path.split("/").pop() || f.path),
          size: files.reduce((sum, f) => sum + f.content.length, 0),
        };
      }
      
      return { 
        ok: true, 
        data: {
          ...agent,
          resolved,
          workspaceStats,
        }
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  })

  // ─── Create Agent ───────────────────────────────────────
  .post("/", async ({ body }) => {
    try {
      const agentConfig: AgentConfig = {
        id: body.id || body.name?.toLowerCase().replace(/\s+/g, "-") || crypto.randomUUID(),
        name: body.name || body.identity?.name || "New Agent",
        isDefault: body.default,
        identity: body.identity,
        model: body.model,
        thinkingLevel: body.thinkingLevel as ThinkingLevel | undefined,
        workspace: body.workspace,
      };
      
      const agent = await createAgent(agentConfig);
      
      return { 
        ok: true, 
        data: {
          agentId: agent.id,
          success: true,
        }
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, {
    body: t.Object({
      id: t.Optional(t.String()),
      name: t.Optional(t.String()),
      default: t.Optional(t.Boolean()),
      workspace: t.Optional(t.String()),
      identity: t.Optional(t.Object({
        name: t.String(),
        emoji: t.Optional(t.String()),
        vibe: t.Optional(t.String()),
        avatar: t.Optional(t.String()),
      })),
      model: t.Optional(t.String()),
      thinkingLevel: t.Optional(t.String()),
    }),
  })

  // ─── Update Agent ───────────────────────────────────────
  .put("/:id", async ({ params, body }) => {
    try {
      await updateAgent(params.id, {
        name: body.name,
        isDefault: body.default,
        identity: body.identity,
        model: body.model,
        thinkingLevel: body.thinkingLevel as ThinkingLevel | undefined,
        workspace: body.workspace,
      });
      
      return { ok: true, data: { success: true } };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      default: t.Optional(t.Boolean()),
      workspace: t.Optional(t.String()),
      identity: t.Optional(t.Object({
        name: t.String(),
        emoji: t.Optional(t.String()),
        vibe: t.Optional(t.String()),
        avatar: t.Optional(t.String()),
      })),
      model: t.Optional(t.String()),
      thinkingLevel: t.Optional(t.String()),
    }),
  })

  // ─── Delete Agent ───────────────────────────────────────
  .delete("/:id", async ({ params }) => {
    try {
      await deleteAgent(params.id);
      return { ok: true, data: { success: true } };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  })

  // ─── Get Agent Workspace Files ──────────────────────────
  .get("/:id/workspace", async ({ params }) => {
    try {
      const workspaceDir = resolveAgentWorkspaceDir(params.id);
      
      if (!existsSync(workspaceDir)) {
        return { ok: true, data: [] };
      }
      
      const files = await loadWorkspaceFiles(workspaceDir);
      
      return { 
        ok: true, 
        data: files.map(f => ({
          name: f.path.split("/").pop(),
          path: f.path,
          content: f.content,
          size: f.content.length,
        }))
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  })

  // ─── Get Single Workspace File ──────────────────────────
  .get("/:id/workspace/:filename", async ({ params }) => {
    try {
      const workspaceDir = resolveAgentWorkspaceDir(params.id);
      const filePath = join(workspaceDir, params.filename);
      
      if (!existsSync(filePath)) {
        return { ok: false, error: `File not found: ${params.filename}` };
      }
      
      const content = await readFile(filePath, "utf-8");
      
      return {
        ok: true,
        data: {
          name: params.filename,
          path: filePath,
          content,
          size: content.length,
        }
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  })

  // ─── Update Workspace File ──────────────────────────────
  .put("/:id/workspace/:filename", async ({ params, body }) => {
    try {
      const workspaceDir = resolveAgentWorkspaceDir(params.id);
      const filePath = join(workspaceDir, params.filename);
      
      await writeFile(filePath, body.content, "utf-8");
      
      return {
        ok: true,
        data: {
          success: true,
          path: filePath,
          size: body.content.length,
        }
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, {
    body: t.Object({
      content: t.String(),
    }),
  })

  // ─── Get Agent Stats ────────────────────────────────────
  .get("/:id/stats", async ({ params }) => {
    try {
      const workspaceDir = resolveAgentWorkspaceDir(params.id);
      
      if (!existsSync(workspaceDir)) {
        return {
          ok: true,
          data: {
            exists: false,
            path: workspaceDir,
            files: [],
            size: 0,
          }
        };
      }
      
      const files = await loadWorkspaceFiles(workspaceDir);
      
      return {
        ok: true,
        data: {
          exists: true,
          path: workspaceDir,
          files: files.map(f => f.path.split("/").pop() || f.path),
          size: files.reduce((sum, f) => sum + f.content.length, 0),
        }
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

// ─── Bindings Routes (removed - no longer needed) ───────────────────

export const bindingsRoutes = new Elysia({ prefix: "/api/bindings" })
  .get("/", async () => {
    return { ok: true, data: [] };
  })
  .post("/", async () => {
    return { ok: false, error: "Bindings are no longer supported. Select agent when creating session." };
  })
  .delete("/:index", async () => {
    return { ok: false, error: "Bindings are no longer supported. Select agent when creating session." };
  });

// ─── Config Routes ────────────────────────────────────────

export const configRoutes = new Elysia({ prefix: "/api/config" })
  .get("/", async () => {
    const agents = await listAgents();
    return {
      ok: true,
      data: {
        agents,
        version: 1,
      }
    };
  });
