/**
 * Custom slash commands for the friend application.
 *
 * These commands are registered via the extension system and can be
 * triggered from the input box by typing "/" followed by the command name.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { IAgentManager } from "../tools";
import { discoverSubagents, formatSubagentList } from "../subagents/index.js";

export interface CommandsExtensionCallbacks {
  /** Called when a command produces a result */
  onCommandResult: (sessionId: string, command: string, success: boolean, message?: string) => void;
}

/**
 * Create the commands extension.
 * Registers custom slash commands for the application.
 */
export function createCommandsExtension(
  manager: IAgentManager,
  callbacks: CommandsExtensionCallbacks,
): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    // Helper to get DB session ID from SDK session ID
    const getDbSessionId = (ctx: ExtensionCommandContext): string | null => {
      // ctx.sessionManager.getSessionId() returns SDK session ID
      // We need to map it to DB session ID
      const sdkSessionId = ctx.sessionManager.getSessionId();
      // The manager should have a method to resolve this
      return (manager as any).resolveDbSessionId?.(sdkSessionId) ?? sdkSessionId;
    };

    // /clear - Clear session messages
    pi.registerCommand("clear", {
      description: "Clear the current session messages",
      handler: async (args, ctx) => {
        const dbSessionId = getDbSessionId(ctx);
        if (dbSessionId) {
          callbacks.onCommandResult(dbSessionId, "clear", true, "Messages cleared");
        }
      },
    });

    // /compact - Compact session context
    pi.registerCommand("compact", {
      description: "Compact the session context to save tokens",
      handler: async (args, ctx) => {
        const dbSessionId = getDbSessionId(ctx);
        if (!dbSessionId) return;

        if (ctx.isIdle()) {
          ctx.compact();
          callbacks.onCommandResult(dbSessionId, "compact", true, "Compacting session context...");
        } else {
          callbacks.onCommandResult(dbSessionId, "compact", false, "Cannot compact while agent is running");
        }
      },
    });

    // /stats - Show session statistics
    pi.registerCommand("stats", {
      description: "Show session statistics (message count, tokens, cost)",
      handler: async (args, ctx) => {
        const dbSessionId = getDbSessionId(ctx);
        if (!dbSessionId) return;

        const usage = ctx.getContextUsage();

        if (usage) {
          const message = `Tokens: ${usage.tokens.toLocaleString()} / ${usage.contextWindow.toLocaleString()} (${usage.percent.toFixed(1)}%)`;
          callbacks.onCommandResult(dbSessionId, "stats", true, message);
        } else {
          callbacks.onCommandResult(dbSessionId, "stats", false, "Statistics not available");
        }
      },
    });

    // /help - Show available commands
    pi.registerCommand("help", {
      description: "Show available slash commands",
      handler: async (args, ctx) => {
        const dbSessionId = getDbSessionId(ctx);
        if (!dbSessionId) return;

        const commands = pi.getCommands();
        const commandList = commands
          .map((cmd) => `/${cmd.name}${cmd.description ? ` - ${cmd.description}` : ""}`)
          .join("\n");
        callbacks.onCommandResult(dbSessionId, "help", true, `Available Commands:\n${commandList}`);
      },
    });

    // /model - Show current model
    pi.registerCommand("model", {
      description: "Show or change the current model",
      handler: async (args, ctx) => {
        const dbSessionId = getDbSessionId(ctx);
        if (!dbSessionId) return;

        const model = ctx.model;
        if (model) {
          callbacks.onCommandResult(dbSessionId, "model", true, `Current model: ${model.provider}/${model.id}`);
        } else {
          callbacks.onCommandResult(dbSessionId, "model", false, "No model selected");
        }
      },
    });

    // /rename - Rename the session
    pi.registerCommand("rename", {
      description: "Rename the current session",
      handler: async (args, ctx) => {
        const dbSessionId = getDbSessionId(ctx);
        if (!dbSessionId) return;

        const newName = args?.trim();
        if (newName) {
          pi.setSessionName(newName);
          callbacks.onCommandResult(dbSessionId, "rename", true, `Session renamed to: ${newName}`);
        } else {
          callbacks.onCommandResult(dbSessionId, "rename", false, "Usage: /rename <new-name>");
        }
      },
    });

    // /abort - Abort current operation
    pi.registerCommand("abort", {
      description: "Abort the current agent operation",
      handler: async (args, ctx) => {
        const dbSessionId = getDbSessionId(ctx);
        if (!dbSessionId) return;

        if (!ctx.isIdle()) {
          ctx.abort();
          callbacks.onCommandResult(dbSessionId, "abort", true, "Aborting current operation...");
        } else {
          callbacks.onCommandResult(dbSessionId, "abort", false, "No operation in progress");
        }
      },
    });

    // /subagents - List available subagents
    pi.registerCommand("subagents", {
      description: "List available subagents",
      handler: async (args, ctx) => {
        const dbSessionId = getDbSessionId(ctx);
        if (!dbSessionId) return;

        try {
          // Parse scope from args (default to "user")
          const scopeArg = args?.trim().toLowerCase();
          let scope: "user" | "workspace" | "both" = "user";
          
          if (scopeArg === "workspace") {
            scope = "workspace";
          } else if (scopeArg === "both") {
            scope = "both";
          } else if (scopeArg && scopeArg !== "user") {
            callbacks.onCommandResult(
              dbSessionId, 
              "subagents", 
              false, 
              "Invalid scope. Use: user, workspace, or both"
            );
            return;
          }

          // Get workspace path from context
          const workspacePath = (ctx as any).workspacePath as string | undefined;
          
          // Discover subagents
          const discovery = discoverSubagents(workspacePath, scope);
          
          if (discovery.agents.length === 0) {
            const scopeMsg = scope === "user" 
              ? "user-level (~/.config/friend/subagents/)" 
              : scope === "workspace"
              ? "workspace-level"
              : "any scope";
            callbacks.onCommandResult(
              dbSessionId, 
              "subagents", 
              true, 
              `No subagents found in ${scopeMsg}`
            );
            return;
          }

          // Format output
          const lines: string[] = [];
          lines.push(`Available Subagents (${scope} scope):`);
          lines.push("");
          
          for (const agent of discovery.agents) {
            lines.push(`  ${agent.name} (${agent.source})`);
            lines.push(`    ${agent.description}`);
            if (agent.tools) {
              lines.push(`    Tools: ${agent.tools.join(", ")}`);
            }
            if (agent.model) {
              lines.push(`    Model: ${agent.model}`);
            }
            lines.push("");
          }

          // Add scope info
          if (scope === "both" && discovery.workspaceAgentsDir) {
            lines.push(`Workspace agents directory: ${discovery.workspaceAgentsDir}`);
          }

          callbacks.onCommandResult(
            dbSessionId, 
            "subagents", 
            true, 
            lines.join("\n")
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          callbacks.onCommandResult(dbSessionId, "subagents", false, `Error: ${errorMsg}`);
        }
      },
    });
  };
}
