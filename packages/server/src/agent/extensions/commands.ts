/**
 * Custom slash commands for the friend application.
 * 
 * These commands are registered via the extension system and can be
 * triggered from the input box by typing "/" followed by the command name.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { IAgentManager } from "../tools";

/**
 * Create the commands extension.
 * Registers custom slash commands for the application.
 */
export function createCommandsExtension(manager: IAgentManager): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    // /clear - Clear session messages (not implemented in SDK, so we just notify)
    pi.registerCommand("clear", {
      description: "Clear the current session messages",
      handler: async (args, ctx) => {
        ctx.ui.notify("⚠️ Clear command: This would clear messages. Feature pending implementation.");
      },
    });

    // /compact - Compact session context
    pi.registerCommand("compact", {
      description: "Compact the session context to save tokens",
      handler: async (args, ctx) => {
        if (ctx.isIdle()) {
          ctx.compact();
          ctx.ui.notify("🗜️ Compacting session context...");
        } else {
          ctx.ui.notify("⚠️ Cannot compact while agent is running.");
        }
      },
    });

    // /stats - Show session statistics
    pi.registerCommand("stats", {
      description: "Show session statistics (message count, tokens, cost)",
      handler: async (args, ctx) => {
        const usage = ctx.getContextUsage();
        const stats = ctx.sessionManager.getSessionStats?.();
        
        if (usage && stats) {
          const message = `📊 Session Stats:\n` +
            `Messages: ${stats.totalMessages || 'N/A'}\n` +
            `Tokens: ${usage.tokens.toLocaleString()} / ${usage.contextWindow.toLocaleString()} (${usage.percent.toFixed(1)}%)\n` +
            `Cost: $${stats.cost?.toFixed(4) || 'N/A'}`;
          ctx.ui.notify(message);
        } else {
          ctx.ui.notify("📊 Statistics not available for this session.");
        }
      },
    });

    // /help - Show available commands
    pi.registerCommand("help", {
      description: "Show available slash commands",
      handler: async (args, ctx) => {
        const commands = pi.getCommands();
        const commandList = commands
          .map(cmd => `  /${cmd.name}${cmd.description ? ` - ${cmd.description}` : ''}`)
          .join('\n');
        ctx.ui.notify(`📋 Available Commands:\n${commandList}`);
      },
    });

    // /model - Show current model
    pi.registerCommand("model", {
      description: "Show or change the current model",
      handler: async (args, ctx) => {
        const model = ctx.model;
        if (model) {
          ctx.ui.notify(`🤖 Current model: ${model.provider}/${model.id}`);
        } else {
          ctx.ui.notify("⚠️ No model selected.");
        }
      },
    });

    // /rename - Rename the session
    pi.registerCommand("rename", {
      description: "Rename the current session",
      handler: async (args, ctx) => {
        const newName = args?.trim();
        if (newName) {
          pi.setSessionName(newName);
          ctx.ui.notify(`✏️ Session renamed to: ${newName}`);
        } else {
          ctx.ui.notify("Usage: /rename <new-name>");
        }
      },
    });

    // /abort - Abort current operation
    pi.registerCommand("abort", {
      description: "Abort the current agent operation",
      handler: async (args, ctx) => {
        if (!ctx.isIdle()) {
          ctx.abort();
          ctx.ui.notify("🛑 Aborting current operation...");
        } else {
          ctx.ui.notify("ℹ️ No operation in progress.");
        }
      },
    });
  };
}
