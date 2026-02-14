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
import { Type } from "@sinclair/typebox";
import type { TodoItem, PlanModeState } from "@friend/shared";

// Re-export for convenience
export type { TodoItem, PlanModeState } from "@friend/shared";

// ─── Constants ────────────────────────────────────────────────────────────

export const PLAN_MODE_TOOLS = ["read", "bash", "grep", "glob", "ls", "question"];
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
  /\$\(/,        // $(...) command substitution
  /`[^`]*`/,     // backtick command substitution
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
  /^\s*cd\b/,
  /^\s*bun\s+--version/i,
  /^\s*deno\s+--version/i,
  /^\s*cargo\s+--version/i,
  /^\s*go\s+(version|doc|vet)\b/i,
  /^\s*rustc\s+--version/i,
  /^\s*pnpm\s+(list|ls|view|info|why|audit)/i,
];

// ─── Utility Functions ────────────────────────────────────────────────────

export function isSafeCommand(command: string): boolean {
  // Allow redirection to /dev/null (for silencing output in plan mode research)
  const commandWithoutDevNull = command.replace(/\s*2?>\s*\/dev\/null/gi, '');

  // Split by && and || first (logical operators), then by | (pipe)
  const logicalParts = commandWithoutDevNull.split(/\s*(?:&&|\|\|)\s*/);

  for (const logicalPart of logicalParts) {
    const pipedParts = logicalPart.split('|').map(p => p.trim()).filter(p => p.length > 0);
    for (const part of pipedParts) {
      if (DESTRUCTIVE_PATTERNS.some((p) => p.test(part))) return false;
      if (!SAFE_PATTERNS.some((p) => p.test(part))) return false;
    }
  }

  return true;
}

function cleanStepText(text: string): string {
  let cleaned = text
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1") // Remove bold/italic
    .replace(/`([^`]+)`/g, "$1") // Remove code
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
  
  // Enhanced Plan header matching - support ## Plan, ### Plan:, ## Implementation Plan:, etc.
  const headerMatch = message.match(/^[ \t]*(?:#{1,4}\s+)?\*{0,2}(?:Implementation\s+)?Plan:?\*{0,2}\s*\r?\n/im);
  if (!headerMatch) {
    console.log('[PlanParser] No Plan: header found in message');
    return items;
  }

  console.log('[PlanParser] Found Plan: header, extracting todos...');
  
  const planSection = message.slice(message.indexOf(headerMatch[0]) + headerMatch[0].length);
  console.log('[PlanParser] Plan section length:', planSection.length, 'preview:', planSection.substring(0, 100));
  
  let currentMainTask: TodoItem | null = null;
  let mainTaskIndex = 0;
  
  // Get all lines to find subtasks
  const lines = planSection.split(/\r?\n/);
  console.log('[PlanParser] Total lines to process:', lines.length);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip empty lines or separator lines
    if (!trimmedLine || trimmedLine === '---') continue;
    
    // Stop parsing if we hit markdown content that's not part of the plan
    // (tables or bold-only lines like "**Why...?**")
    if (trimmedLine.startsWith('|') ||
        (trimmedLine.startsWith('**') && trimmedLine.endsWith('**'))) {
      break;
    }
    // Skip markdown headers within the plan (e.g., "### Phase 1")
    if (trimmedLine.startsWith('#')) {
      continue;
    }
    
    // Check for main task: "1. Task" or "1) Task" (not "1.1" or "1.2")
    // More flexible pattern - capture everything after the number and separator
    const mainMatch = line.match(/^\s*(\d+)[.)]\s+(.+)/);
    const isSubtaskLine = line.match(/^\s*\d+\.\d+/);
    
    if (mainMatch && !isSubtaskLine) {
      const rawText = mainMatch[2].trim();
      // Remove trailing markdown bold/italic markers
      const text = rawText.replace(/\*{1,2}$/, "").trim();
      
      console.log('[PlanParser] Line', i, '- Main task match:', mainMatch[1], 'text:', text.substring(0, 50));
      
      if (text.length > 3 && !text.startsWith("-")) {
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
          console.log('[PlanParser] Added main task', mainTaskIndex, ':', cleaned);
        }
      }
    }
    // Check for subtask: "1.1. Subtask"
    else if (currentMainTask && isSubtaskLine) {
      const subMatch = line.match(/^\s*(\d+)\.(\d+)[.)]\s+(.+)/);
      if (subMatch) {
        const rawText = subMatch[3].trim();
        const text = rawText.replace(/\*{1,2}$/, "").trim();
        
        console.log('[PlanParser] Line', i, '- Subtask match:', subMatch[1] + '.' + subMatch[2], 'text:', text.substring(0, 50));
        
        if (text.length > 3) {
          const cleaned = cleanStepText(text);
          if (cleaned.length > 3 && currentMainTask.subtasks) {
            currentMainTask.subtasks.push({
              step: currentMainTask.subtasks.length + 1,
              text: cleaned,
              completed: false
            });
            console.log('[PlanParser] Added subtask to task', currentMainTask.step, ':', cleaned);
          }
        }
      }
    }
    // Also support bullet point subtasks under a main task
    else if (currentMainTask && line.match(/^\s*[-•]\s+/)) {
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
  
  // Remove empty subtasks arrays
  for (const item of items) {
    if (item.subtasks && item.subtasks.length === 0) {
      delete item.subtasks;
    }
  }
  
  console.log('[PlanParser] Extracted', items.length, 'main tasks');
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
You are in plan mode — read-only exploration for analysis and planning.

## Restrictions
- Available tools: read, bash (read-only), grep, glob, ls, question
- Disabled tools: edit, write
- Bash is restricted to read-only commands

## Phase 1: Explore

Thoroughly investigate the codebase before writing any plan. Use this checklist:

- [ ] Read the files directly related to the task
- [ ] Identify existing patterns and conventions to follow
- [ ] Trace dependencies: what imports/calls/uses the code you'll change?
- [ ] Find similar implementations in the codebase to reference
- [ ] Check for tests, types, and configs that will need updates
- [ ] Note potential risks or edge cases

Take your time — read more files rather than fewer. The plan quality depends on exploration depth.

## Phase 2: Report & Plan

After exploring, output your response in two parts:

### Part 1 — Analysis (markdown)
Brief summary of your findings:
- Key files and their roles
- Existing patterns you'll follow
- Dependencies and impact scope

### Part 2 — Plan (CRITICAL - MUST BE INCLUDED)
End your response with the actionable plan in this EXACT format:

Plan:
1. Action verb + what to do + where (file path)
   1.1. Specific subtask
   1.2. Specific subtask
2. Next step description
3. Simple step (subtasks optional)

## Important Rules

1. **ALWAYS output a Plan section** - even if you have questions
2. **If you need user input** - use the \`question\` tool BEFORE writing the plan
3. **Do NOT write "待确认" or ask questions in text** - use the question tool or proceed with reasonable defaults
4. **End with the last plan step** - no commentary after the plan
5. **Use the same language as the user**`;

export function getExecutionContextPrompt(todos: TodoItem[]): string {
  const remaining = todos.filter((t) => !t.completed);
  if (remaining.length === 0) return "";

  const currentStep = remaining[0];
  const currentLines: string[] = [`${currentStep.step}. ${currentStep.text}`];
  if (currentStep.subtasks) {
    for (const sub of currentStep.subtasks.filter(s => !s.completed)) {
      currentLines.push(`   ${currentStep.step}.${sub.step}. ${sub.text}`);
    }
  }

  const remainingLines: string[] = [];
  for (const t of remaining.slice(1)) {
    remainingLines.push(`${t.step}. ${t.text}`);
    if (t.subtasks) {
      for (const sub of t.subtasks.filter(s => !s.completed)) {
        remainingLines.push(`   ${t.step}.${sub.step}. ${sub.text}`);
      }
    }
  }

  const remainingSection = remainingLines.length > 0
    ? `\n\nRemaining steps:\n${remainingLines.join("\n")}`
    : "";

  return `[EXECUTING PLAN — Full tool access enabled]

Current step:
${currentLines.join("\n")}
${remainingSection}

Focus on the current step. After completing it, include [DONE:${currentStep.step}] in your response (or [DONE:n.m] for subtasks). Then stop and wait — the next step will be given to you.`;
}

/**
 * Generate context prompt for plan modification mode.
 * This is used when user sends a new message while a plan is ready.
 */
export function getModifyContextPrompt(todos: TodoItem[], userMessage: string): string {
  // Build current plan as text
  const planLines: string[] = [];
  for (const t of todos) {
    planLines.push(`${t.step}. ${t.text}`);
    if (t.subtasks) {
      for (const sub of t.subtasks) {
        planLines.push(`   ${t.step}.${sub.step}. ${sub.text}`);
      }
    }
  }
  const currentPlan = planLines.join("\n");

  return `[PLAN MODIFICATION MODE]
The user wants to modify the existing plan. Read their feedback and adjust accordingly.

## Current Plan

${currentPlan}

## User's Request

${userMessage}

## Your Task

1. Understand what changes the user wants
2. If the changes affect new areas of code, explore them first
3. Update the plan to incorporate their feedback
4. Output the COMPLETE updated plan (not just the changes)

## Output Format - CRITICAL

You MUST output the complete updated plan in this exact format:

Plan:
1. Main task description here
   1.1. Subtask one description here
   1.2. Subtask two description here
2. Next main task description here

## Guidelines

- Keep steps that are still relevant
- Add new steps where needed
- Remove or modify steps based on user feedback
- Re-number steps if order changes
- Maintain the same detailed, actionable style
- End your response with the last step — do NOT add commentary, tables, or explanations after the plan`;
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
  /** Called when next task should be executed */
  onContinue?: (sessionId: string, nextTask: TodoItem) => void;
}

/**
 * Create a plan mode extension.
 * This extension is managed by AgentManager and communicates via callbacks.
 */
export function createPlanModeExtension(callbacks: PlanModeExtensionCallbacks): (pi: ExtensionAPI) => void {
  // Session-specific state (managed externally via callbacks)
  const sessionStates = new Map<string, PlanModeState>();

  const getState = (sessionId: string): PlanModeState => {
    return callbacks.getState(sessionId) ?? { enabled: false, executing: false, modifying: false, todos: [] };
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
          modifying: false,
          todos: [],
        };

        setState(sessionId, newState);

        if (newState.enabled) {
          pi.setActiveTools(PLAN_MODE_TOOLS);
          ctx.ui.notify("📋 Plan mode enabled. Read-only tools only. Use planner subagent for complex tasks.");

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

    // Register tool for agent to proactively enter plan mode
    pi.registerTool({
      name: "enter_plan_mode",
      label: "Enter Plan Mode",
      description: `Enter plan mode for complex tasks requiring analysis before implementation. In plan mode, write tools are disabled — you explore with read-only tools, then output a numbered plan for user review.

Use when: multi-file changes, architectural decisions, refactoring, or unclear requirements.
Don't use when: single-file edits, quick fixes, or straightforward changes.`,
      parameters: Type.Object({
        reason: Type.String({ description: "Brief explanation of why plan mode is needed (e.g., 'Task involves multiple interconnected components' or 'Need to understand existing patterns before implementing')" }),
        task_description: Type.String({ description: "Description of the task you need to plan for" }),
      }),
      execute: async (toolCallId, params, signal, onUpdate, ctx) => {
        const sessionId = ctx.sessionManager.getSessionId();
        const current = getState(sessionId);

        if (current.enabled) {
          return {
            content: [{ type: "text" as const, text: "Already in plan mode. Continue with your analysis and create a plan." }],
            details: { enabled: true },
          };
        }

        // Enable plan mode
        const newState: PlanModeState = {
          enabled: true,
          executing: false,
          modifying: false,
          todos: [],
        };
        setState(sessionId, newState);
        pi.setActiveTools(PLAN_MODE_TOOLS);
        ctx.ui.notify("📋 Plan mode enabled via tool call.");

        // Return message telling agent to start planning
        return {
          content: [{
            type: "text" as const,
            text: `Plan mode enabled. You now have read-only access to analyze the codebase.

Task: ${params.task_description}
Reason for planning: ${params.reason}

Instructions:
1. Use read-only tools to explore the codebase
2. Create a detailed implementation plan
3. Output the plan in the specified format

You can now proceed with your analysis.`,
          }],
          details: { enabled: true, task: params.task_description },
        };
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

      // Handle modify mode - inject modify context with current plan
      if (state.modifying && state.todos.length > 0 && state.modifyMessage) {
        const context = getModifyContextPrompt(state.todos, state.modifyMessage);
        return {
          message: {
            customType: "plan-modify-context",
            content: context,
            display: false,
          },
        };
      }

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
          setState(sessionId, { enabled: false, executing: false, modifying: false, todos: [] });
          pi.setActiveTools(NORMAL_MODE_TOOLS);
          return;
        }
        
        // Continue with next task
        const nextTask = state.todos.find((t) => !t.completed);
        if (nextTask && callbacks.onContinue) {
          callbacks.onContinue(sessionId, nextTask);
          return;
        }
      }

      // Smart extraction: always check for Plan: format, even if not in plan mode
      // This handles the case where AI outputs a plan without calling enter_plan_mode tool
      if (!state.executing) {
        const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
        if (lastAssistant) {
          const text = getTextContent(lastAssistant);
          const extracted = extractTodoItems(text);
          if (extracted.length > 0) {
            // Auto-enable plan mode if not already enabled
            const wasAlreadyEnabled = state.enabled || state.modifying;
            const newState: PlanModeState = {
              ...state,
              enabled: true,  // Stay in plan mode
              executing: false,  // Not executing - plan is ready for review
              modifying: false,  // Clear modifying flag
              modifyMessage: undefined,  // Clear modify message
              todos: extracted,
            };
            setState(sessionId, newState);
            
            // Only notify if this is a new plan (not already in plan mode)
            if (!wasAlreadyEnabled) {
              pi.setActiveTools(PLAN_MODE_TOOLS);
            }
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
