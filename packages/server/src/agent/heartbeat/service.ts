/**
 * Heartbeat Service
 * 
 * Periodically checks HEARTBEAT.md files for each agent and executes tasks.
 * Inspired by PicoClaw and OpenClaw implementations.
 */

import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { AgentConfig } from "../agent-manager.js";

// ─── Constants ──────────────────────────────────────────────

const MIN_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes minimum
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;  // 30 minutes default
const CHECK_INTERVAL_MS = 60 * 1000;  // Check every 1 minute
const HEARTBEAT_TOKEN = "HEARTBEAT_OK";

// ─── Types ───────────────────────────────────────────────────

export interface HeartbeatAgentState {
  agentId: string;
  lastRunAtMs: number | null;
  intervalMs: number;
}

export interface HeartbeatResult {
  agentId: string;
  status: "executed" | "skipped" | "error";
  message?: string;
  error?: string;
}

export interface HeartbeatServiceDeps {
  getAgents: () => Promise<AgentConfig[]>;
  getAgentWorkspace: (agentId: string) => string;
  executeAgentTask: (agentId: string, prompt: string) => Promise<string>;
  broadcastEvent?: (event: { type: string; agentId: string; status: string; message?: string }) => void;
}

// ─── HeartbeatService ────────────────────────────────────────

export class HeartbeatService {
  private deps: HeartbeatServiceDeps;
  private agentStates: Map<string, HeartbeatAgentState> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private log: (level: string, agentId: string, message: string) => void;

  constructor(deps: HeartbeatServiceDeps) {
    this.deps = deps;
    this.log = (level, agentId, msg) => this.logToFile(agentId, level, msg);
  }

  // ─── Lifecycle ────────────────────────────────────────────

  start(): void {
    if (this.timer) {
      console.log("[Heartbeat] Service already running");
      return;
    }

    this.timer = setInterval(() => this.checkAllAgents(), CHECK_INTERVAL_MS);
    console.log("[Heartbeat] Service started");
    
    // Run initial check after a short delay
    setTimeout(() => this.checkAllAgents(), 5000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[Heartbeat] Service stopped");
  }

  // ─── Core Logic ───────────────────────────────────────────

  private async checkAllAgents(): Promise<void> {
    if (this.running) return;  // Prevent concurrent runs
    this.running = true;

    try {
      const agents = await this.deps.getAgents();
      const now = Date.now();

      for (const agent of agents) {
        const state = this.getOrCreateState(agent);
        
        // Check if it's time to run for this agent
        if (state.lastRunAtMs !== null) {
          const elapsed = now - state.lastRunAtMs;
          if (elapsed < state.intervalMs) {
            continue;  // Not yet time for this agent
          }
        }

        // Execute heartbeat for this agent
        await this.executeHeartbeat(agent.id);
      }
    } catch (err) {
      console.error("[Heartbeat] Error checking agents:", err);
    } finally {
      this.running = false;
    }
  }

  private async executeHeartbeat(agentId: string): Promise<HeartbeatResult> {
    const workspace = this.deps.getAgentWorkspace(agentId);
    const heartbeatPath = join(workspace, "HEARTBEAT.md");
    
    // Read HEARTBEAT.md
    let content: string;
    try {
      content = await readFile(heartbeatPath, "utf-8");
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // File doesn't exist, skip
        return { agentId, status: "skipped", message: "HEARTBEAT.md not found" };
      }
      throw err;
    }

    // Check if content is effectively empty
    if (isContentEmpty(content)) {
      return { agentId, status: "skipped", message: "HEARTBEAT.md is empty" };
    }

    // Build prompt
    const prompt = this.buildPrompt(content);
    
    this.log("INFO", agentId, "Executing heartbeat");

    try {
      const response = await this.deps.executeAgentTask(agentId, prompt);
      
      // Update state
      const state = this.agentStates.get(agentId);
      if (state) {
        state.lastRunAtMs = Date.now();
      }

      // Check response
      const trimmedResponse = response.trim();
      if (trimmedResponse === HEARTBEAT_TOKEN || trimmedResponse.includes(HEARTBEAT_TOKEN)) {
        this.log("INFO", agentId, "Heartbeat OK");
        return { agentId, status: "executed", message: "HEARTBEAT_OK" };
      }

      // Non-empty response - log and potentially broadcast
      this.log("INFO", agentId, `Heartbeat response: ${trimmedResponse.slice(0, 200)}...`);
      
      // Broadcast to frontend if there's meaningful content
      if (this.deps.broadcastEvent && trimmedResponse && trimmedResponse !== HEARTBEAT_TOKEN) {
        this.deps.broadcastEvent({
          type: "heartbeat",
          agentId,
          status: "completed",
          message: trimmedResponse.slice(0, 500),
        });
      }

      return { agentId, status: "executed", message: trimmedResponse.slice(0, 200) };
    } catch (err: any) {
      this.log("ERROR", agentId, `Heartbeat error: ${err.message}`);
      
      // Broadcast error
      if (this.deps.broadcastEvent) {
        this.deps.broadcastEvent({
          type: "heartbeat",
          agentId,
          status: "error",
          message: err.message,
        });
      }

      return { agentId, status: "error", error: err.message };
    }
  }

  // ─── State Management ─────────────────────────────────────

  private getOrCreateState(agent: AgentConfig): HeartbeatAgentState {
    let state = this.agentStates.get(agent.id);
    if (!state) {
      state = {
        agentId: agent.id,
        lastRunAtMs: null,
        intervalMs: this.parseInterval(agent.heartbeat?.every) ?? DEFAULT_INTERVAL_MS,
      };
      this.agentStates.set(agent.id, state);
    }
    return state;
  }

  private parseInterval(every?: string): number | null {
    if (!every) return null;
    
    // Parse formats like "30m", "1h", "2h30m"
    const match = every.match(/^(\d+)(h|m)?(\d+)?(m|h)?$/);
    if (!match) return null;

    let ms = 0;
    const str = every.toLowerCase();
    
    // Hours
    const hoursMatch = str.match(/(\d+)h/);
    if (hoursMatch) {
      ms += parseInt(hoursMatch[1]) * 60 * 60 * 1000;
    }
    
    // Minutes
    const minutesMatch = str.match(/(\d+)m/);
    if (minutesMatch) {
      ms += parseInt(minutesMatch[1]) * 60 * 1000;
    }
    
    // Just a number - assume minutes
    if (!hoursMatch && !minutesMatch) {
      const num = parseInt(every);
      if (!isNaN(num)) {
        ms = num * 60 * 1000;
      }
    }

    return Math.max(ms, MIN_INTERVAL_MS);
  }

  // ─── Prompt Building ──────────────────────────────────────

  private buildPrompt(content: string): string {
    const now = new Date();
    const timestamp = now.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return `# Heartbeat Check

Current time: ${timestamp}

You are a proactive AI assistant. This is a scheduled heartbeat check.
Review the following tasks and execute any necessary actions.
If there is nothing that requires attention, respond ONLY with: ${HEARTBEAT_TOKEN}

---

${content}`;
  }

  // ─── Logging ──────────────────────────────────────────────

  private async logToFile(agentId: string, level: string, message: string): Promise<void> {
    const workspace = this.deps.getAgentWorkspace(agentId);
    const logPath = join(workspace, "heartbeat.log");
    
    // Ensure workspace exists
    await mkdir(workspace, { recursive: true }).catch(() => {});
    
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}\n`;
    
    await appendFile(logPath, line).catch((err) => {
      console.error(`[Heartbeat] Failed to write log for ${agentId}:`, err);
    });
  }

  // ─── Force Run ────────────────────────────────────────────

  /**
   * Force run heartbeat for a specific agent immediately.
   */
  async runNow(agentId: string): Promise<HeartbeatResult> {
    return this.executeHeartbeat(agentId);
  }

  /**
   * Get current state for all agents.
   */
  getStates(): HeartbeatAgentState[] {
    return Array.from(this.agentStates.values());
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Check if HEARTBEAT.md content is effectively empty.
 * Returns true if content contains only whitespace, comments, or empty markdown structures.
 */
function isContentEmpty(content: string): boolean {
  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Skip markdown headers (# followed by space or EOL)
    if (/^#+(\s|$)/.test(trimmed)) continue;
    
    // Skip empty markdown list items
    if (/^[-*+]\s*(\[[\sXx]?\]\s*)?$/.test(trimmed)) continue;
    
    // Found non-empty content
    return false;
  }
  
  return true;
}
