/**
 * Plan Mode Extension
 *
 * A two-phase workflow for complex tasks:
 * 1. Plan phase: read-only exploration, output numbered plan
 * 2. Execute phase: full tool access, track progress with [DONE:n] markers
 *
 * This extension handles:
 * - Tool restrictions in plan mode
 * - Context injection (plan mode / execution mode)
 * - Plan extraction from agent response
 * - Progress tracking with [DONE:n] markers
 *
 * The state management and SSE events are handled by AgentManager.
 */

import type { ExtensionAPI, ExtensionContext, ToolCallEvent, AgentEndEvent, TurnEndEvent, SessionStartEvent, BeforeAgentStartEvent } from "@mariozechner/pi-coding-agent";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai";

// ─── Types ───────────────────────────────────────────────────────────────

export interface TodoItem {
  step: number;
  text: string;
  completed: boolean;
}

export interface PlanModeState {
  enabled: boolean;
  executing: boolean;
  todos: TodoItem[];
}

export type PlanModeAction = "execute" | "cancel" | "modify";

// ─── Constants ────────────────────────────────────────────────────────────

export const PLAN_MODE_TOOLS = ["read", "bash", "grep", "glob", "ls"];
export const NORMAL_MODE_TOOLS = ["read", "bash", "edit", "write", "grep", "glob", "ls"];

// Destructive commands blocked in plan mode
const DESTRUCTIVE_PATTERNS = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bmv\b/i,
  /\bcp\b/i,
  /\bmkdir\b/i,
  /\btouch\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bchgrp\b/i,
  /\bln\b/i,
  /\btee\b/i,
  /\btruncate\b/i,
  /\bdd\b/i,
  /\bshred\b/i,
  /(^|[^<])>(?!>)/,
  />>/,
  /\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
  /\byarn\s+(add|remove|install|publish)/i,
  /\bpnpm\s+(add|remove|install|publish)/i,
  /\bpip\s+(install|uninstall)/i,
  /\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
  /\bbrew\s+(install|uninstall|upgrade)/i,
  /\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bkill\b/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  /\breboot\b/i,
  /\bshutdown\b/i,
  /\bsystemctl\s+(start|stop|restart|enable|disable)/i,
  /\bservice\s+\S+\s+(start|stop|restart)/i,
  /\b(vim?|nano|emacs|code|subl)\b/i,
];

// Safe read-only commands allowed in plan mode
const SAFE_PATTERNS = [
  /^\s*cat\b/,
  /^\s*head\b/,
  /^\s*tail\b/,
  /^\s*less\b/,
  /^\s*more\b/,
  /^\s*grep\b/,
  /^\s*find\b/,
  /^\s*ls\b/,
  /^\s*pwd\b/,
  /^\s*echo\b/,
  /^\s*printf\b/,
  /^\s*wc\b/,
  /^\s*sort\b/,
  /^\s*uniq\b/,
  /^\s*diff\b/,
  /^\s*file\b/,
  /^\s*stat\b/,
  /^\s*du\b/,
  /^\s*df\b/,
  /^\s*tree\b/,
  /^\s*which\b/,
  /^\s*whereis\b/,
  /^\s*type\b/,
  /^\s*env\b/,
  /^\s*printenv\b/,
  /^\s*uname\b/,
  /^\s*whoami\b/,
  /^\s*id\b/,
  /^\s*date\b/,
  /^\s*cal\b/,
  /^\s*uptime\b/,
  /^\s*ps\b/,
  /^\s*top\b/,
  /^\s*htop\b/,
  /^\s*free\b/,
  // Git read-only commands (with optional cd prefix)
  /(^|\s||&&|\|\|)\s*git\s+(status|log|diff|show|branch|remote|config\s+--get)\b/i,
  /^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get)\b/i,
  /^\s*git\s+ls-/i,
  /^\s*npm\s+(list|ls|view|info|search|outdated|audit)/i,
  /^\s*yarn\s+(list|info|why|audit)/i,
  /^\s*node\s+--version/i,
  /^\s*python\s+--version/i,
  /^\s*curl\s/i,
  /^\s*wget\s+-O\s*-/i,
  /^\s*jq\b/,
  /^\s*sed\s+-n/i,
  /^\s*awk\b/,
  /^\s*rg\b/,
  /^\s*fd\b/,
  /^\s*bat\b/,
  /^\s*exa\b/,
];

// ─── Utility Functions ────────────────────────────────────────────────────

export function isSafeCommand(command: string): boolean {
  const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
  const isSafe = SAFE_PATTERNS.some((p) => p.test(command));
  return !isDestructive && isSafe;
}

function cleanStepText(text: string): string {
  let cleaned = text
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1") // Remove bold/italic
    .replace(/`([^`]+)`/g, "$1") // Remove code
    .replace(
      /^(Use|Run|Execute|Create|Write|Read|Check|Verify|Update|Modify|Add|Remove|Delete|Install)\s+(the\s+)?/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (cleaned.length > 60) {
    cleaned = `${cleaned.slice(0, 57)}...`;
  }
  return cleaned;
}

export function extractTodoItems(message: string): TodoItem[] {
  const items: TodoItem[] = [];
  const headerMatch = message.match(/\*{0,2}Plan:\*{0,2}\s*\n/i);
  if (!headerMatch) return items;

  const planSection = message.slice(message.indexOf(headerMatch[0]) + headerMatch[0].length);
  const numberedPattern = /^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/gm;

  for (const match of planSection.matchAll(numberedPattern)) {
    const text = match[2]
      .trim()
      .replace(/\*{1,2}$/, "")
      .trim();
    if (text.length > 5 && !text.startsWith("`") && !text.startsWith("/") && !text.startsWith("-")) {
      const cleaned = cleanStepText(text);
      if (cleaned.length > 3) {
        items.push({ step: items.length + 1, text: cleaned, completed: false });
      }
    }
  }
  return items;
}

function extractDoneSteps(message: string): number[] {
  const steps: number[] = [];
  for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
    const step = Number(match[1]);
    if (Number.isFinite(step)) steps.push(step);
  }
  return steps;
}

export function markCompletedSteps(text: string, items: TodoItem[]): number {
  const doneSteps = extractDoneSteps(text);
  for (const step of doneSteps) {
    const item = items.find((t) => t.step === step);
    if (item) item.completed = true;
  }
  return doneSteps.length;
}

// Type guard for assistant messages
export function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
  return m.role === "assistant" && Array.isArray(m.content);
}

// Extract text content from an assistant message
export function getTextContent(message: AssistantMessage): string {
  return message.content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// ─── Plan Mode Prompts ────────────────────────────────────────────────────

export const PLAN_MODE_CONTEXT_PROMPT = `[PLAN MODE ACTIVE]
You are in plan mode - a read-only exploration mode for safe code analysis.

Restrictions:
- You can only use: read, bash (read-only), grep, glob, ls
- You CANNOT use: edit, write (file modifications are disabled)
- Bash is restricted to an allowlist of read-only commands

Create a detailed numbered plan under a "Plan:" header:

Plan:
1. First step description
2. Second step description
...

Do NOT attempt to make changes - just describe what you would do.
After completing your analysis, present the plan and wait for user confirmation.`;

export function getExecutionContextPrompt(todos: TodoItem[]): string {
  const remaining = todos.filter((t) => !t.completed);
  if (remaining.length === 0) return "";

  const todoList = remaining.map((t) => `${t.step}. ${t.text}`).join("\n");
  return `[EXECUTING PLAN - Full tool access enabled]

Remaining steps:
${todoList}

Execute each step in order.
After completing a step, include a [DONE:n] tag in your response (e.g., [DONE:1] for step 1).`;
}

// ─── Plan Mode Extension Factory ──────────────────────────────────────────

export interface PlanModeExtensionCallbacks {
  /** Get current plan mode state for a session */
  getState: (sessionId: string) => PlanModeState;
  /** Set plan mode state for a session */
  setState: (sessionId: string, state: PlanModeState) => void;
  /** Called when agent finishes planning and needs user choice */
  onPlanReady: (sessionId: string, todos: TodoItem[]) => void;
  /** Called when progress is made during execution */
  onProgress: (sessionId: string, todos: TodoItem[]) => void;
}

/**
 * Create a plan mode extension.
 * This extension is managed by AgentManager and communicates via callbacks.
 */
export function createPlanModeExtension(callbacks: PlanModeExtensionCallbacks): (pi: ExtensionAPI) => void {
  // Session-specific state (managed externally via callbacks)
  const sessionStates = new Map<string, PlanModeState>();

  const getState = (sessionId: string): PlanModeState => {
    return callbacks.getState(sessionId) ?? { enabled: false, executing: false, todos: [] };
  };

  const setState = (sessionId: string, state: PlanModeState) => {
    sessionStates.set(sessionId, state);
    callbacks.setState(sessionId, state);
  };

  return (pi: ExtensionAPI) => {
    // Register /plan command to toggle plan mode
    pi.registerCommand("plan", {
      description: "Toggle plan mode (read-only exploration)",
      handler: async (_args, ctx) => {
        console.log("[PlanMode] /plan command handler called!");
        const sessionId = ctx.sessionManager.getSessionId();
        const current = getState(sessionId);

        const newState: PlanModeState = {
          enabled: !current.enabled,
          executing: false,
          todos: [],
        };

        console.log(`[PlanMode] Toggling plan mode: ${current.enabled} -> ${newState.enabled}`);
        setState(sessionId, newState);

        if (newState.enabled) {
          pi.setActiveTools(PLAN_MODE_TOOLS);
          ctx.ui.notify("📋 Plan mode enabled. Read-only tools only.");
        } else {
          pi.setActiveTools(NORMAL_MODE_TOOLS);
          ctx.ui.notify("Plan mode disabled. Full access restored.");
        }
      },
    });
    console.log("[PlanMode] /plan command registered via pi.registerCommand");

    // Block destructive bash commands in plan mode
    pi.on("tool_call", async (event, ctx) => {
      if (event.toolName !== "bash") return;

      const sessionId = ctx.sessionManager.getSessionId();
      if (!sessionId) return;

      const state = getState(sessionId);
      if (!state.enabled) return;

      const command = event.input.command as string;
      if (!isSafeCommand(command)) {
        return {
          block: true,
          reason: `🚫 Plan mode: command blocked (not in allowlist).\nUse /plan to disable plan mode first.\nCommand: ${command}`,
        };
      }
    });

    // Inject plan/execution context before agent starts
    pi.on("before_agent_start", async (event, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();
      if (!sessionId) return;

      const state = getState(sessionId);

      if (state.enabled && !state.executing) {
        return {
          message: {
            customType: "plan-mode-context",
            content: PLAN_MODE_CONTEXT_PROMPT,
            display: false,
          },
        };
      }

      if (state.executing && state.todos.length > 0) {
        const context = getExecutionContextPrompt(state.todos);
        if (context) {
          return {
            message: {
              customType: "plan-execution-context",
              content: context,
              display: false,
            },
          };
        }
      }
    });

    // Track progress after each turn during execution
    pi.on("turn_end", async (event, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();
      if (!sessionId) return;

      const state = getState(sessionId);

      if (!state.executing || state.todos.length === 0) return;
      if (!isAssistantMessage(event.message)) return;

      const text = getTextContent(event.message);
      const changed = markCompletedSteps(text, state.todos);

      if (changed > 0) {
        setState(sessionId, { ...state });
        callbacks.onProgress(sessionId, state.todos);
      }
    });

    // Handle plan completion
    pi.on("agent_end", async (event, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();
      if (!sessionId) return;

      const state = getState(sessionId);

      // Check if execution is complete
      if (state.executing && state.todos.length > 0) {
        if (state.todos.every((t) => t.completed)) {
          // All done - clear state
          setState(sessionId, { enabled: false, executing: false, todos: [] });
          pi.setActiveTools(NORMAL_MODE_TOOLS);
          return;
        }
      }

      // In plan mode - extract todos and notify
      if (state.enabled && !state.executing) {
        const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
        if (lastAssistant) {
          const extracted = extractTodoItems(getTextContent(lastAssistant));
          if (extracted.length > 0) {
            const newState: PlanModeState = {
              ...state,
              todos: extracted,
            };
            setState(sessionId, newState);
            callbacks.onPlanReady(sessionId, extracted);
          }
        }
      }
    });

    // Restore state on session start
    pi.on("session_start", async (event, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();
      if (!sessionId) return;

      const state = getState(sessionId);

      if (state.enabled || state.executing) {
        if (state.enabled && !state.executing) {
          pi.setActiveTools(PLAN_MODE_TOOLS);
        }
      }
    });
  };
}

// ─── Complexity Detection ────────────────────────────────────────────────

/**
 * Keywords and patterns that suggest a complex task requiring planning.
 */
const PLAN_TRIGGERS = {
  // High-confidence keywords (require explicit planning intent)
  keywords: [
    "重构", "架构设计", "系统设计", "实现方案", "迁移方案", "从零开始",
    "refactor", "architect", "system design", "implementation plan", "migrate",
    "完整实现", "系统实现", "模块设计",
    "step by step", "详细计划", "帮我规划",
  ],

  // Pattern matches (require multiple steps clearly)
  patterns: [
    /添加.*功能.*步骤/i,
    /实现.*系统/i,
    /创建.*模块.*设计/i,
    /how to implement.*step/i,
    /帮我(设计|规划|实现).*方案/i,
    /如何(实现|设计)/i,
    /详细.*计划/i,
  ],
};

/**
 * Simple command patterns that should NOT trigger plan mode.
 */
const SIMPLE_COMMANDS = [
  /^(提交|commit|push|pull|合并|merge)/i,
  /^(运行|run|启动|start|停止|stop)/i,
  /^(查看|show|list|显示)/i,
  /^(修复|fix|更新|update|删除|delete|添加|add)\s*(一个|单个)?/i,
  /^(先|然后|接下来)/i,
  /^\/\w+/,  // Slash commands like /plan
  /^(ok|好|好了|发送|发送了|执行|取消|退出)/i,  // Short confirmations
];

/**
 * Check if a message suggests a complex task requiring planning.
 * Returns a score from 0-1, where higher means more likely to need planning.
 */
export function checkComplexity(message: string): number {
  // Skip simple commands
  const trimmed = message.trim();
  for (const pattern of SIMPLE_COMMANDS) {
    if (pattern.test(trimmed)) {
      return 0;
    }
  }

  // Short messages are unlikely to be complex
  if (trimmed.length < 10) {
    return 0;
  }

  let score = 0;

  // Check keywords
  for (const keyword of PLAN_TRIGGERS.keywords) {
    if (message.toLowerCase().includes(keyword.toLowerCase())) {
      score += 0.2;
    }
  }

  // Check patterns
  for (const pattern of PLAN_TRIGGERS.patterns) {
    if (pattern.test(message)) {
      score += 0.25;
    }
  }

  // Length heuristic - longer messages tend to be more complex
  if (message.length > 100) score += 0.1;
  if (message.length > 200) score += 0.1;

  // Multiple sentences might indicate complex request
  const sentences = message.split(/[.!?。！？]/).filter(Boolean);
  if (sentences.length >= 3) score += 0.1;

  // Mentioning multiple files
  const fileMentions = (message.match(/@\S+/g) || []).length;
  if (fileMentions >= 2) score += 0.15;

  return Math.min(score, 1);
}

/**
 * Should the message trigger plan mode?
 */
export function shouldTriggerPlanMode(message: string, threshold = 0.3): boolean {
  return checkComplexity(message) >= threshold;
}
