/**
 * Agent configuration management
 * 
 * Handles loading, resolving, and managing agent configurations.
 * Agents are stored in the database, workspace files in ~/.config/friend/agents/{id}/
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { prisma } from "@friend/db";
import type { ThinkingLevel } from "@friend/shared";
import { DEFAULT_AGENT_ID, DEFAULT_IDENTITY } from "@friend/shared";
import { APP_CONFIG_DIR } from "./paths.js";

// ─── Types ────────────────────────────────────────────────

export interface AgentIdentity {
  name?: string;
  emoji?: string;
  vibe?: string;
  avatar?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  isDefault?: boolean;
  identity?: AgentIdentity;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  workspace?: string;
  /** Heartbeat configuration */
  heartbeat?: {
    /** Interval for heartbeat checks (e.g., "30m", "1h") */
    every?: string;
  };
  skills?: string[];
}

export interface ResolvedAgentConfig extends AgentConfig {
  identity: Required<AgentIdentity>;
  model: string;
  thinkingLevel: ThinkingLevel;
}

// ─── Defaults ──────────────────────────────────────────────

const DEFAULT_AGENT: AgentConfig = {
  id: DEFAULT_AGENT_ID,
  name: "Main Assistant",
  isDefault: true,
  identity: DEFAULT_IDENTITY,
  model: "anthropic/claude-sonnet-4-5",
  thinkingLevel: "medium",
};

// ─── Path Helpers ──────────────────────────────────────────

export function getAgentWorkspaceBase(): string {
  return join(APP_CONFIG_DIR, "agents");
}

export function resolveAgentWorkspaceDir(agentId: string): string {
  return join(getAgentWorkspaceBase(), agentId, "workspace");
}

export function resolveAgentSessionsDir(agentId: string): string {
  return join(getAgentWorkspaceBase(), agentId, "sessions");
}

export function resolveAgentSkillsDir(agentId: string): string {
  return join(getAgentWorkspaceBase(), agentId, "skills");
}

// ─── Database Operations ───────────────────────────────────

/**
 * Get all agents from database
 */
export async function listAgents(): Promise<AgentConfig[]> {
  const agents = await prisma.agent.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return agents.map((a) => ({
    id: a.id,
    name: a.name,
    isDefault: a.isDefault,
    identity: {
      name: a.name,
      emoji: a.emoji ?? undefined,
      vibe: a.vibe ?? undefined,
      avatar: a.avatar ?? undefined,
    },
    model: a.defaultModel ?? undefined,
    thinkingLevel: a.thinkingLevel as ThinkingLevel | undefined,
    workspace: a.workspacePath ?? undefined,
    heartbeat: a.heartbeatEvery ? { every: a.heartbeatEvery } : undefined,
  }));
}

/**
 * Get a single agent by ID
 */
export async function getAgent(id: string): Promise<AgentConfig | null> {
  const agent = await prisma.agent.findUnique({
    where: { id },
  });

  if (!agent) return null;

  return {
    id: agent.id,
    name: agent.name,
    isDefault: agent.isDefault,
    identity: {
      name: agent.name,
      emoji: agent.emoji ?? undefined,
      vibe: agent.vibe ?? undefined,
      avatar: agent.avatar ?? undefined,
    },
    model: agent.defaultModel ?? undefined,
    thinkingLevel: agent.thinkingLevel as ThinkingLevel | undefined,
    workspace: agent.workspacePath ?? undefined,
    heartbeat: agent.heartbeatEvery ? { every: agent.heartbeatEvery } : undefined,
  };
}

/**
 * Get default agent
 */
export async function getDefaultAgent(): Promise<AgentConfig> {
  const agent = await prisma.agent.findFirst({
    where: { isDefault: true },
  });

  if (agent) {
    return {
      id: agent.id,
      name: agent.name,
      isDefault: true,
      identity: {
        name: agent.name,
        emoji: agent.emoji ?? undefined,
        vibe: agent.vibe ?? undefined,
        avatar: agent.avatar ?? undefined,
      },
      model: agent.defaultModel ?? undefined,
      thinkingLevel: agent.thinkingLevel as ThinkingLevel | undefined,
      workspace: agent.workspacePath ?? undefined,
      heartbeat: agent.heartbeatEvery ? { every: agent.heartbeatEvery } : undefined,
    };
  }

  // Create default agent if not exists
  return createAgent(DEFAULT_AGENT);
}

/**
 * Create a new agent
 */
export async function createAgent(config: AgentConfig): Promise<AgentConfig> {
  // Check if ID exists
  const existing = await prisma.agent.findUnique({
    where: { id: config.id },
  });

  if (existing) {
    throw new Error(`Agent with ID "${config.id}" already exists`);
  }

  // If setting as default, unset other defaults
  if (config.isDefault) {
    await prisma.agent.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const agent = await prisma.agent.create({
    data: {
      id: config.id,
      name: config.name || config.identity?.name || config.id,
      isDefault: config.isDefault ?? false,
      emoji: config.identity?.emoji,
      vibe: config.identity?.vibe,
      avatar: config.identity?.avatar,
      defaultModel: config.model,
      thinkingLevel: config.thinkingLevel,
      workspacePath: config.workspace,
      heartbeatEvery: config.heartbeat?.every,
    },
  });

  // Create workspace directory with all default files
  const workspaceDir = resolveAgentWorkspaceDir(agent.id);
  const { ensureAgentWorkspace } = await import("./bootstrap.js");
  await ensureAgentWorkspace(workspaceDir, {
    agentName: config.identity?.name,
    agentEmoji: config.identity?.emoji,
    agentVibe: config.identity?.vibe,
  });

  return {
    id: agent.id,
    name: agent.name,
    isDefault: agent.isDefault,
    identity: {
      name: agent.name,
      emoji: agent.emoji ?? undefined,
      vibe: agent.vibe ?? undefined,
      avatar: agent.avatar ?? undefined,
    },
    model: agent.defaultModel ?? undefined,
    thinkingLevel: agent.thinkingLevel as ThinkingLevel | undefined,
    workspace: agent.workspacePath ?? undefined,
    heartbeat: agent.heartbeatEvery ? { every: agent.heartbeatEvery } : undefined,
  };
}

/**
 * Update an existing agent
 */
export async function updateAgent(
  id: string,
  updates: Partial<AgentConfig>,
): Promise<AgentConfig> {
  // If setting as default, unset other defaults
  if (updates.isDefault) {
    await prisma.agent.updateMany({
      where: { isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  const agent = await prisma.agent.update({
    where: { id },
    data: {
      name: updates.name ?? updates.identity?.name,
      isDefault: updates.isDefault,
      emoji: updates.identity?.emoji,
      vibe: updates.identity?.vibe,
      avatar: updates.identity?.avatar,
      defaultModel: updates.model,
      thinkingLevel: updates.thinkingLevel,
      workspacePath: updates.workspace,
      heartbeatEvery: updates.heartbeat?.every,
    },
  });

  return {
    id: agent.id,
    name: agent.name,
    isDefault: agent.isDefault,
    identity: {
      name: agent.name,
      emoji: agent.emoji ?? undefined,
      vibe: agent.vibe ?? undefined,
      avatar: agent.avatar ?? undefined,
    },
    model: agent.defaultModel ?? undefined,
    thinkingLevel: agent.thinkingLevel as ThinkingLevel | undefined,
    workspace: agent.workspacePath ?? undefined,
    heartbeat: agent.heartbeatEvery ? { every: agent.heartbeatEvery } : undefined,
  };
}

/**
 * Delete an agent
 */
export async function deleteAgent(id: string): Promise<void> {
  if (id === DEFAULT_AGENT_ID) {
    throw new Error("Cannot delete the default agent");
  }

  const agent = await prisma.agent.findUnique({
    where: { id },
  });

  if (!agent) {
    throw new Error(`Agent "${id}" not found`);
  }

  if (agent.isDefault) {
    throw new Error("Cannot delete the default agent");
  }

  // Delete from database
  await prisma.agent.delete({
    where: { id },
  });

  // Delete workspace directory
  const workspaceBase = getAgentWorkspaceBase();
  const agentDir = join(workspaceBase, id);
  if (existsSync(agentDir)) {
    await rm(agentDir, { recursive: true, force: true });
  }
}

/**
 * Resolve full agent config with defaults
 */
export async function resolveAgentConfig(id: string): Promise<ResolvedAgentConfig> {
  const agent = await getAgent(id);
  const defaultAgent = await getDefaultAgent();

  if (!agent) {
    throw new Error(`Agent "${id}" not found`);
  }

  return {
    id: agent.id,
    name: agent.name,
    isDefault: agent.isDefault,
    identity: {
      name: agent.identity?.name || agent.name,
      emoji: agent.identity?.emoji || defaultAgent.identity?.emoji || DEFAULT_IDENTITY.emoji!,
      vibe: agent.identity?.vibe || defaultAgent.identity?.vibe || DEFAULT_IDENTITY.vibe!,
      avatar: agent.identity?.avatar || defaultAgent.identity?.avatar || DEFAULT_IDENTITY.avatar!,
    },
    model: agent.model || defaultAgent.model || "anthropic/claude-sonnet-4-5",
    thinkingLevel: agent.thinkingLevel || defaultAgent.thinkingLevel || "medium",
    workspace: agent.workspace,
    heartbeat: agent.heartbeat,
  };
}

// ─── Initialization ────────────────────────────────────────

/**
 * Initialize default agent if not exists
 */
export async function ensureDefaultAgent(): Promise<void> {
  const count = await prisma.agent.count();
  if (count === 0) {
    await createAgent(DEFAULT_AGENT);
    console.log(`Created default agent: ${DEFAULT_AGENT_ID}`);
  }
}
