/**
 * Session Manager
 * 
 * Handles session creation, retrieval, and basic operations.
 * Note: This is different from the SDK's SessionManager - this manages
 * ManagedSession instances at the application level.
 */

import { prisma } from "@friend/db";
import type { SessionInfo, SessionDetail, Message } from "@friend/shared";
import type { AgentSession, SessionStats, SlashCommandInfo } from "@mariozechner/pi-coding-agent";
import type { ISessionManager, SessionManagerDeps, ManagedSession } from "./types.js";
import type { PlanModeState, PendingQuestion } from "@friend/shared";

export class SessionManager implements ISessionManager {
  private readonly deps: SessionManagerDeps;

  constructor(deps: SessionManagerDeps) {
    this.deps = deps;
  }

  async listSessions(): Promise<SessionInfo[]> {
    const sessions = this.deps.getManagedSessions();
    return Array.from(sessions.values()).map((s) => ({
      id: s.id,
      name: s.name,
      agentId: s.agentId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      model: s.session.model ? `${s.session.model.provider}/${s.session.model.id}` : undefined,
      messageCount: s.session.messages.length,
      workingPath: s.workingPath,
    }));
  }

  async getSession(id: string): Promise<SessionDetail | null> {
    const managed = this.deps.getManagedSessions().get(id);
    if (!managed) return null;

    const messages = managed.session.messages.filter(
      (m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
    );

    // Get plan mode state - note: this should be fetched from PlanModeManager
    // For now, we return undefined as this manager doesn't have direct access
    const planModeState: PlanModeState | undefined = undefined;

    // Get pending question - note: this should be fetched from QuestionManager
    const pendingQuestion: { questionId: string; questions: any[] } | undefined = undefined;

    return {
      id: managed.id,
      name: managed.name,
      agentId: managed.agentId,
      createdAt: managed.createdAt,
      updatedAt: managed.updatedAt,
      model: managed.session.model
        ? `${managed.session.model.provider}/${managed.session.model.id}`
        : undefined,
      messageCount: messages.length,
      messages,
      workingPath: managed.workingPath,
      isStreaming: managed.session.isStreaming,
      planModeState,
      pendingQuestion,
    };
  }

  async renameSession(
    id: string,
    name: string,
    broadcastEvent = true,
  ): Promise<{ success: boolean; oldName?: string; error?: "not_found" }> {
    const sessions = this.deps.getManagedSessions();
    const managed = sessions.get(id);
    if (!managed) return { success: false, error: "not_found" };

    const oldName = managed.name;
    if (oldName === name) return { success: true, oldName };

    managed.name = name;
    managed.updatedAt = new Date().toISOString();
    managed.autoRenamed = true;

    // Update DB
    await prisma.session.update({ where: { id }, data: { name } }).catch(() => {});

    // Broadcast rename event
    if (broadcastEvent) {
      // Note: This should use deps.broadcast, but for now we skip
      // The caller (AgentManager) should handle broadcasting
    }

    return { success: true, oldName };
  }

  async deleteSession(id: string): Promise<boolean> {
    const sessions = this.deps.getManagedSessions();
    const managed = sessions.get(id);
    if (!managed) return false;

    const sessionFile = managed.session.sessionManager.getSessionFile();
    managed.session.dispose();
    this.deps.deleteManagedSession(id);

    // Delete from DB
    await prisma.session.delete({ where: { id } }).catch(() => {});

    // Clean up session file
    if (sessionFile) {
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(sessionFile);
      } catch {}
    }

    return true;
  }

  async getOrCreateSessionForAgent(agentId: string): Promise<ManagedSession> {
    // This is a placeholder - the actual implementation is in AgentManager
    // because it requires complex logic for session creation
    throw new Error("getOrCreateSessionForAgent should be implemented in AgentManager");
  }

  async createSession(opts?: { 
    name?: string; 
    workingPath?: string;
    agentId?: string;
  }): Promise<SessionInfo> {
    // This is a placeholder - the actual implementation is in AgentManager
    // because it requires complex logic including model registry access
    throw new Error("createSession should be implemented in AgentManager");
  }

  /**
   * Get stats for a session
   */
  getStats(id: string): SessionStats | null {
    const managed = this.deps.getManagedSessions().get(id);
    if (!managed) return null;
    return managed.session.getSessionStats();
  }

  /**
   * Get commands for a session
   */
  getCommands(id: string): SlashCommandInfo[] {
    const managed = this.deps.getManagedSessions().get(id);
    if (!managed) return [];

    const extensionRunner = managed.session.extensionRunner;
    if (!extensionRunner) return [];

    const commands = extensionRunner.getRegisteredCommands();
    return commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      source: "extension" as const,
    }));
  }

  /**
   * Execute a command in a session
   */
  async executeCommand(id: string, name: string, args?: string): Promise<void> {
    const managed = this.deps.getManagedSessions().get(id);
    if (!managed) throw new Error(`Session ${id} not found`);

    const commandText = args ? `/${name} ${args}` : `/${name}`;
    await managed.session.prompt(commandText);
  }
}
