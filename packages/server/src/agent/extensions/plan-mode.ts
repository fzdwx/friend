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
  subtasks?: TodoItem[];  // Optional nested subtasks
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
  
  // Match main tasks: "1. Task text" (not "1.1" or "1.2")
  const mainTaskPattern = /^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/gm;
  
  let currentMainTask: TodoItem | null = null;
  let mainTaskIndex = 0;
  
  // Get all lines to find subtasks
  const lines = planSection.split('\n');
  
  for (const line of lines) {
    // Check for main task: "1. Task" (single digit, not "1.1")
    const mainMatch = line.match(/^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/);
    if (mainMatch && !line.match(/^\s*\d+\.\d+/)) {
      const text = mainMatch[2].trim().replace(/\*{1,2}$/, "").trim();
      if (text.length > 3 && !text.startsWith("`") && !text.startsWith("/") && !text.startsWith("-")) {
        const cleaned = cleanStepText(text);
        if (cleaned.length > 3) {
          mainTaskIndex++;
          currentMainTask = { 
            step: mainTaskIndex, 
            text: cleaned, 
            completed: false,
            subtasks: []
          };
          items.push(currentMainTask);
        }
      }
    }
    // Check for subtask: "1.1. Subtask" or "  - Subtask" (indented)
    else if (currentMainTask) {
      const subMatch = line.match(/^\s*(\d+)\.(\d+)[.)]\s+\*{0,2}([^*\n]+)/);
      if (subMatch) {
        const text = subMatch[3].trim().replace(/\*{1,2}$/, "").trim();
        if (text.length > 3) {
          const cleaned = cleanStepText(text);
          if (cleaned.length > 3 && currentMainTask.subtasks) {
            currentMainTask.subtasks.push({
              step: currentMainTask.subtasks.length + 1,
              text: cleaned,
              completed: false
            });
          }
        }
      }
      // Also support bullet point subtasks under a main task
      else if (line.match(/^\s*[-•]\s+/)) {
        const bulletMatch = line.match(/^\s*[-•]\s+(.+)/);
        if (bulletMatch && currentMainTask.subtasks) {
          const text = bulletMatch[1].trim();
          if (text.length > 3) {
            currentMainTask.subtasks.push({
              step: currentMainTask.subtasks.length + 1,
              text,
              completed: false
            });
          }
        }
      }
    }
  }
  
  // Remove empty subtasks arrays
  for (const item of items) {
    if (item.subtasks && item.subtasks.length === 0) {
      delete item.subtasks;
    }
  }
  
  return items;
}

// Extract completed steps from message, returns { main: number[], sub: Map<main, number[]> }
function extractDoneSteps(message: string): { mainSteps: number[]; subSteps: Map<number, number[]> } {
  const mainSteps: number[] = [];
  const subSteps = new Map<number, number[]>();
  
  // Match [DONE:1] or [DONE:1.1]
  for (const match of message.matchAll(/\[DONE:(\d+)(?:\.(\d+))?\]/gi)) {
    const mainStep = Number(match[1]);
    const subStep = match[2] ? Number(match[2]) : null;
    
    if (Number.isFinite(mainStep)) {
      if (subStep !== null && Number.isFinite(subStep)) {
        // Subtask: [DONE:1.1]
        if (!subSteps.has(mainStep)) {
          subSteps.set(mainStep, []);
        }
        subSteps.get(mainStep)!.push(subStep);
      } else {
        // Main task: [DONE:1]
        mainSteps.push(mainStep);
      }
    }
  }
  return { mainSteps, subSteps };
}

export function markCompletedSteps(text: string, items: TodoItem[]): number {
  const { mainSteps, subSteps } = extractDoneSteps(text);
  let changedCount = 0;
  
  // Mark main tasks
  for (const step of mainSteps) {
    const item = items.find((t) => t.step === step);
    if (item && !item.completed) {
      item.completed = true;
      changedCount++;
    }
  }
  
  // Mark subtasks
  for (const [mainStep, subs] of subSteps) {
    const item = items.find((t) => t.step === mainStep);
    if (item?.subtasks) {
      for (const subStep of subs) {
        const subtask = item.subtasks.find((s) => s.step === subStep);
        if (subtask && !subtask.completed) {
          subtask.completed = true;
          changedCount++;
        }
      }
      // If all subtasks completed, mark main task as completed too
      if (item.subtasks.every((s) => s.completed)) {
        item.completed = true;
      }
    }
  }
  
  return changedCount;
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
You are in plan mode - a read-only exploration mode for detailed code analysis and planning.

Restrictions:
- You can only use: read, bash (read-only), grep, glob, ls
- You CANNOT use: edit, write (file modifications are disabled)
- Bash is restricted to an allowlist of read-only commands

## Your Task

1. First, THOROUGHLY analyze the codebase:
   - Read relevant source files to understand existing patterns
   - Check for related implementations that can be referenced
   - Identify dependencies and imports needed
   - Find the exact files that need to be modified or created

2. Then, create a DETAILED execution plan with:
   - Exact file paths for each file to create/modify
   - Specific code changes or new code to write
   - Dependencies to install
   - Configuration changes needed

## Output Format

Output ONLY the plan. Be specific and detailed.

Plan:
1. [Specific action with file path]
   1.1. [Detailed subtask with specific code/function names]
   1.2. [Another detailed subtask]
2. [Next specific action]
...

## Plan Quality Guidelines

GOOD Plan:
- Specific file paths: "Create packages/server/src/agent/tools/browser.ts"
- Specific function names: "Implement screenshot() function using playwright"
- Specific changes: "Add 'playwright' to dependencies in package.json"
- Includes context: "Follow the pattern from read.ts tool"

BAD Plan (too vague):
- "Create the tool file"
- "Implement the function"
- "Add dependencies"

## Example Plan

Plan:
1. Install playwright dependency
   1.1. Add "playwright": "^1.42.0" to packages/server/package.json dependencies
   1.2. Run bun install in packages/server directory
2. Create browser tool file at packages/server/src/agent/tools/browser.ts
   2.1. Import chromium from 'playwright' and Type from '@sinclair/typebox'
   2.2. Define BrowserParams schema with action, url, selector, script fields
   2.3. Create createBrowserTool() function following pattern from read.ts
   2.4. Implement screenshot action that returns base64 encoded image
   2.5. Implement navigate action that opens URL in browser
3. Register browser tool in packages/server/src/agent/manager.ts
   3.1. Import createBrowserTool from "./tools/browser.js"
   3.2. Add createBrowserTool() to customTools array in createSession()
4. Test the tool by sending a test message

Now analyze the codebase thoroughly and create your detailed plan.`;

export function getExecutionContextPrompt(todos: TodoItem[]): string {
  const remaining = todos.filter((t) => !t.completed);
  if (remaining.length === 0) return "";

  // Build todo list with subtasks
  const lines: string[] = [];
  for (const t of remaining) {
    lines.push(`${t.step}. ${t.text}`);
    if (t.subtasks) {
      for (const sub of t.subtasks.filter(s => !s.completed)) {
        lines.push(`   ${t.step}.${sub.step}. ${sub.text}`);
      }
    }
  }
  const todoList = lines.join("\n");

  return `[EXECUTING PLAN - Full tool access enabled]

Remaining steps:
${todoList}

Execute each step in order.
After completing a step, include a [DONE:n] tag in your response.
For subtasks, use [DONE:n.m] format (e.g., [DONE:1.1] for subtask 1.1).`;
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
      handler: async (args, ctx) => {
        const sessionId = ctx.sessionManager.getSessionId();
        const current = getState(sessionId);

        const newState: PlanModeState = {
          enabled: !current.enabled,
          executing: false,
          todos: [],
        };

        setState(sessionId, newState);

        if (newState.enabled) {
          pi.setActiveTools(PLAN_MODE_TOOLS);
          ctx.ui.notify("📋 Plan mode enabled. Read-only tools only.");
          
          // If there are args, send them as a user message to trigger AI processing
          if (args && args.trim()) {
            pi.sendUserMessage(args.trim());
          }
        } else {
          pi.setActiveTools(NORMAL_MODE_TOOLS);
          ctx.ui.notify("Plan mode disabled. Full access restored.");
        }
      },
    });

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
