/**
 * File Tracker Extension
 *
 * Tracks files modified during a session by listening to edit/write tool calls.
 * This extension updates the ManagedSession.modifiedFiles set.
 */

import type { ExtensionAPI, ExtensionContext, ToolCallEvent } from "@mariozechner/pi-coding-agent";

export interface FileTrackerCallbacks {
  /** Get the session ID from context */
  getSessionId: (ctx: ExtensionContext) => string | undefined;
  /** Add a modified file to the session */
  addModifiedFile: (sessionId: string, filePath: string) => void;
}

/**
 * Create a file tracker extension.
 * This extension tracks edit and write tool calls and records modified files.
 */
export function createFileTrackerExtension(callbacks: FileTrackerCallbacks): (pi: ExtensionAPI) => void {
  console.log('[FileTracker] Extension created');
  return (pi: ExtensionAPI) => {
    console.log('[FileTracker] Extension registered');
    // Listen for tool calls and track file modifications
    pi.on("tool_call", async (event: ToolCallEvent, ctx: ExtensionContext) => {
      const { toolName, input } = event;
      console.log(`[FileTracker] tool_call event: ${toolName}`);
      
      // Only track edit and write tools
      if (toolName !== "edit" && toolName !== "write") return;
      
      const sessionId = callbacks.getSessionId(ctx);
      console.log(`[FileTracker] sessionId: ${sessionId}`);
      if (!sessionId) return;
      
      // Extract file path from tool input
      let filePath: string | undefined;
      
      if (toolName === "edit" && input && typeof input === "object") {
        filePath = (input as { path?: string }).path;
      } else if (toolName === "write" && input && typeof input === "object") {
        filePath = (input as { path?: string }).path;
      }
      
      if (filePath && typeof filePath === "string") {
        console.log(`[FileTracker] Adding file: ${filePath}`);
        callbacks.addModifiedFile(sessionId, filePath);
        console.log(`[FileTracker] Session ${sessionId} modified: ${filePath}`);
      }
      
      // Don't block the tool call
      return undefined;
    });
  };
}
