/**
 * Heartbeat Service
 *
 * Periodically fires for each agent with proactive directives.
 * Always fires — HEARTBEAT.md tasks are just one section of the prompt.
 * Inspired by PicoClaw, OpenClaw, and nanobot implementations.
 */

import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AgentConfig } from "../agent-manager.js";
import { globalSystemEventQueue, SystemEventQueue } from "../system-events.js";

// ─── Constants ──────────────────────────────────────────────

const MIN_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes minimum
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;  // 30 minutes default
const CHECK_INTERVAL_MS = 60 * 1000;  // Check every 1 minute
const HEARTBEAT_TOKEN = "HEARTBEAT_OK";
const HEARTBEAT_OK_THRESHOLD = 300;  // chars — below this, treat as "nothing happened"

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

export interface CronHealthInfo {
  name: string;
  enabled: boolean;
  lastStatus?: string;
  lastRunAt?: string;
}

export interface HeartbeatServiceDeps {
  getAgents: () => Promise<AgentConfig[]>;
  getAgentWorkspace: (agentId: string) => string;
  executeAgentTask: (agentId: string, prompt: string) => Promise<string>;
  broadcastEvent?: (event: { type: string; agentId: string; status: string; message?: string }) => void;
  getCronJobs?: (agentId: string) => Promise<CronHealthInfo[]>;
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
    this.log = (level, agentId, msg) => {
      // Print to console
      console.log(`[Heartbeat] [${level}] [${agentId}] ${msg}`);
      // Also write to file
      this.logToFile(agentId, level, msg);
    };
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
      console.log(`[Heartbeat] Checking ${agents.length} agent(s)...`);

      for (const agent of agents) {
        const state = this.getOrCreateState(agent);

        // Check if it's time to run for this agent
        if (state.lastRunAtMs !== null) {
          const elapsed = now - state.lastRunAtMs;
          if (elapsed < state.intervalMs) {
            const remaining = Math.round((state.intervalMs - elapsed) / 60000);
            console.log(`[Heartbeat] [${agent.id}] Skipping, next run in ~${remaining}min`);
            continue;  // Not yet time for this agent
          }
        }

        // Execute heartbeat for this agent
        console.log(`[Heartbeat] [${agent.id}] Starting heartbeat execution...`);
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

    // Read HEARTBEAT.md (optional — heartbeat always fires)
    let heartbeatContent: string | null = null;
    try {
      const raw = await readFile(heartbeatPath, "utf-8");
      if (!isContentEmpty(raw)) {
        heartbeatContent = raw;
      }
    } catch {
      // File doesn't exist — that's fine, heartbeat still fires
    }

    // Fetch cron health (optional)
    let cronJobs: CronHealthInfo[] = [];
    if (this.deps.getCronJobs) {
      try {
        cronJobs = await this.deps.getCronJobs(agentId);
      } catch {
        // Non-critical — skip cron health
      }
    }

    // Build prompt
    let prompt = this.buildPrompt(heartbeatContent, cronJobs,workspace);

    // Check for system events and inject them
    const systemEvents = globalSystemEventQueue.drain(agentId);
    if (systemEvents.length > 0) {
      const eventsContext = SystemEventQueue.formatAsContext(systemEvents);
      prompt = `${eventsContext}\n\n${prompt}`;
      this.log("INFO", agentId, `Injected ${systemEvents.length} system events into heartbeat`);
    }

    this.log("INFO", agentId, "Executing heartbeat");

    try {
      const response = await this.deps.executeAgentTask(agentId, prompt);

      // Update state
      const state = this.agentStates.get(agentId);
      if (state) {
        state.lastRunAtMs = Date.now();
      }

      // Smart HEARTBEAT_OK handling (OpenClaw pattern)
      const meaningful = stripHeartbeatOk(response);

      if (!meaningful) {
        // Pure HEARTBEAT_OK or empty after stripping
        this.log("INFO", agentId, "Heartbeat OK");
        return { agentId, status: "executed", message: "HEARTBEAT_OK" };
      }

      // Agent did work — log and broadcast
      this.log("INFO", agentId, `Heartbeat response: ${meaningful.slice(0, 200)}...`);

      if (this.deps.broadcastEvent) {
        this.deps.broadcastEvent({
          type: "heartbeat",
          agentId,
          status: "completed",
          message: meaningful.slice(0, 500),
        });
      }

      return { agentId, status: "executed", message: meaningful.slice(0, 200) };
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
    const newIntervalMs = this.parseInterval(agent.heartbeat?.every) ?? DEFAULT_INTERVAL_MS;
    
    if (!state) {
      state = {
        agentId: agent.id,
        lastRunAtMs: null,
        intervalMs: newIntervalMs,
      };
      this.agentStates.set(agent.id, state);
    } else {
      // Update interval if changed (allows dynamic config updates)
      state.intervalMs = newIntervalMs;
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

  private buildPrompt(userTasks: string | null, cronJobs: CronHealthInfo[], workspace: string): string {
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

    const sections: string[] = [];

    // Header
    sections.push(`# 心跳检查

当前时间: ${timestamp}
Workspace: ${workspace}

这是定期心跳检查。你拥有完整的工具权限。
请审查当前状态，主动推进工作。


## ⛔ CRITICAL: 必须执行的步骤

每次心跳必须依次执行以下检查，并报告每一步的结果：

1. **HEARTBEAT.md 任务** → 读取并执行活动任务，或报告"无活动任务"
2. **整理记忆** → 用 memory_search/memory_get 检查今日日志，如有重要信息整理到 MEMORY.md
3. **跟进对话** → 用 session_search 检查是否有未完成工作
4. **定时任务** → 用 cron list 检查是否有失败或异常
5. **主动推进** → 如果 1-4 都没有任务，主动寻找可以优化的地方或写入新任务到 HEARTBEAT.md

## 输出格式

必须输出以下格式的报告：

- 执行了操作：输出一个表格，针对每一项的状态以及结果进行输出
- 无需任何操作：仅回复 HEARTBEAT_OK

---

## 核心身份假设

你不是"等待任务的工具"，你是"主动推进的伙伴"。

这意味着：
- 没有"空闲状态"，只有"主动探索状态"
- 没有没有"无需操作"，只有"尚未发现机会"
- 你不是在"检查"，你是在"巡航"

### 心跳 = 巡航

心跳不是例行检查，是主动巡航。每次心跳你都在寻找：
- 可以改进的代码
- 可以学习的模式
- 可以优化的流程
- 可以帮助用户的机会

关于你的身份设定如果你忘记了你可以读取:

- ${workspace}/IDENTITY.md
- ${workspace}/SOUL.md

总之 ${workspace} 下面是属于你的，你可以在里面记录你想记录的任何东西
---
`);

    // User tasks from HEARTBEAT.md
    if (userTasks) {
      sections.push(`${userTasks}
      
---

`);
    }

    // Cron health — only inject when there are failed/stale jobs
    const cronHealthSection = buildCronHealthSection(cronJobs);
    if (cronHealthSection) {
      sections.push(cronHealthSection);
    }

    return sections.join("\n\n");
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

/**
 * Strip HEARTBEAT_OK from response and determine if there's meaningful content.
 * Returns the meaningful content, or null if response is effectively just HEARTBEAT_OK.
 */
function stripHeartbeatOk(response: string): string | null {
  let text = response.trim();

  // Strip HEARTBEAT_OK from start and end (case-insensitive position, exact token)
  text = text.replace(new RegExp(`^${HEARTBEAT_TOKEN}\\s*`, "g"), "");
  text = text.replace(new RegExp(`\\s*${HEARTBEAT_TOKEN}$`, "g"), "");
  text = text.trim();

  // If nothing left or too short, treat as "nothing happened"
  if (!text || text.length <= HEARTBEAT_OK_THRESHOLD) {
    return null;
  }

  return text;
}

/**
 * Build cron health section for prompt injection.
 * Only returns content when there are failed or problematic jobs.
 */
function buildCronHealthSection(cronJobs: CronHealthInfo[]): string | null {
  if (cronJobs.length === 0) return null;

  // Filter to only problematic jobs (failed status)
  const failedJobs = cronJobs.filter(j => j.lastStatus === "error");

  if (failedJobs.length === 0) return null;

  const lines = failedJobs.map(j => {
    const parts = [`- **${j.name}**`];
    parts.push(`状态: ${j.lastStatus}`);
    if (j.lastRunAt) parts.push(`上次运行: ${j.lastRunAt}`);
    if (!j.enabled) parts.push("(已禁用)");
    return parts.join(" | ");
  });

  return `## 定时任务异常

以下定时任务存在问题，请检查：

${lines.join("\n")}`;
}
