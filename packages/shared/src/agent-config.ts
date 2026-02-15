/**
 * Agent configuration types
 * 
 * This module defines the configuration structure for Friend's multi-agent system.
 * Inspired by OpenClaw's agent architecture.
 */

import type { ThinkingLevel, CustomProviderConfig } from "./models.js";

// ─── Agent Identity ────────────────────────────────────────

export interface AgentIdentity {
  /** Agent's display name */
  name: string;
  
  /** Signature emoji */
  emoji?: string;
  
  /** Personality description */
  vibe?: string;
  
  /** Avatar URL or path */
  avatar?: string;
}

// ─── Agent Config ──────────────────────────────────────────

export interface AgentConfig {
  /** Unique agent ID */
  id: string;
  
  /** Display name */
  name?: string;
  
  /** Whether this is the default agent */
  default?: boolean;
  
  /** Custom workspace path (defaults to ~/.config/friend/agents/{id}/workspace) */
  workspace?: string;
  
  /** Agent-specific identity (overrides defaults) */
  identity?: Partial<AgentIdentity>;
  
  /** Agent-specific model (overrides defaults) */
  model?: string;
  
  /** Agent-specific thinking level */
  thinkingLevel?: ThinkingLevel;
  
  /** Skill allowlist (if empty, all skills allowed) */
  skills?: string[];
  
  /** Agent-specific tools configuration */
  tools?: Record<string, unknown>;
  
  /** Agent-specific memory search config */
  memorySearch?: {
    enabled?: boolean;
    provider?: "openai" | "gemini" | "voyage" | "local" | "auto";
    model?: string;
  };
  
  /** Human delay simulation config */
  humanDelay?: {
    enabled?: boolean;
    minMs?: number;
    maxMs?: number;
  };
  
  /** Heartbeat config */
  heartbeat?: {
    /** Interval for heartbeat checks (e.g., "30m", "1h", "2h") */
    every?: string;
    /** Where to send heartbeat results (default: "last" - last active session) */
    target?: "last" | "whatsapp" | "telegram" | "discord" | "none";
  };
  
  /** Group chat behavior */
  groupChat?: {
    mentionPatterns?: string[];
    requireMention?: boolean;
  };
}

// ─── Binding Rules ─────────────────────────────────────────

export interface BindingMatch {
  /** Glob pattern to match against working directory */
  cwdPattern?: string;
  
  /** Exact working directory path */
  cwd?: string;
  
  /** Channel name (future: route by channel) */
  channel?: string;
  
  /** Account ID (future: route by account) */
  accountId?: string;
}

export interface BindingRule {
  /** Target agent ID */
  agentId: string;
  
  /** Match conditions (all must match if multiple specified) */
  match: BindingMatch;
  
  /** Priority (higher = checked first, default: 0) */
  priority?: number;
}

// ─── Agent Defaults ────────────────────────────────────────

export interface AgentDefaults {
  /** Default model for all agents */
  model?: string;
  
  /** Default thinking level */
  thinkingLevel?: ThinkingLevel;
  
  /** Default identity (can be overridden per-agent) */
  identity?: AgentIdentity;
  
  /** Default skill allowlist */
  skills?: string[];
  
  /** Default tools config */
  tools?: Record<string, unknown>;
  
  /** Default memory search config */
  memorySearch?: AgentConfig["memorySearch"];
  
  /** Default human delay */
  humanDelay?: AgentConfig["humanDelay"];
  
  /** Default heartbeat */
  heartbeat?: AgentConfig["heartbeat"];
  
  /** Default group chat behavior */
  groupChat?: AgentConfig["groupChat"];
}

// ─── Friend Config ────────────────────────────────────────

export interface FriendConfig {
  /** Config version */
  version: number;
  
  /** Global defaults */
  defaults: {
    model: string;
    thinkingLevel: ThinkingLevel;
    activeThemeId: string;
  };
  
  /** Agent configuration */
  agents: {
    defaults: AgentDefaults;
    list: AgentConfig[];
  };
  
  /** Binding rules (determines which agent to use for a given context) */
  bindings: BindingRule[];
  
  /** Custom model providers */
  customProviders: CustomProviderConfig[];
}

// ─── Resolved Agent Config ─────────────────────────────────

/**
 * Fully resolved agent config with all defaults applied
 */
export interface ResolvedAgentConfig {
  id: string;
  name: string;
  workspace: string;
  identity: AgentIdentity;
  model: string;
  thinkingLevel: ThinkingLevel;
  isDefault: boolean;
  
  // Optional configs
  skills?: string[];
  tools?: Record<string, unknown>;
  memorySearch?: AgentConfig["memorySearch"];
  humanDelay?: AgentConfig["humanDelay"];
  heartbeat?: AgentConfig["heartbeat"];
  groupChat?: AgentConfig["groupChat"];
}

// ─── Constants ─────────────────────────────────────────────

export const DEFAULT_AGENT_ID = "main";

export const DEFAULT_IDENTITY: AgentIdentity = {
  name: "Friend",
  emoji: "🤖",
  vibe: "Helpful coding assistant",
};

export const DEFAULT_FRIEND_CONFIG: FriendConfig = {
  version: 1,
  defaults: {
    model: "anthropic/claude-sonnet-4-5",
    thinkingLevel: "medium",
    activeThemeId: "default-dark",
  },
  agents: {
    defaults: {
      model: "anthropic/claude-sonnet-4-5",
      thinkingLevel: "medium",
      identity: DEFAULT_IDENTITY,
      heartbeat: {
        every: "30m",
        target: "last",
      },
    },
    list: [
      {
        id: DEFAULT_AGENT_ID,
        default: true,
        name: "Main Assistant",
      },
    ],
  },
  bindings: [],
  customProviders: [],
};
