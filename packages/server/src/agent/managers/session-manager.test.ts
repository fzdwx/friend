import { describe, test, expect, beforeEach, mock } from "bun:test";
import { SessionManager } from "./session-manager.js";
import type { SessionManagerDeps, ManagedSession } from "./types.js";
import type { SessionInfo, SessionDetail } from "@friend/shared";

// ─── Tests ────────────────────────────────────────────────────────

describe("SessionManager", () => {
  let manager: SessionManager;
  let mockDeps: SessionManagerDeps;
  let mockSessions: Map<string, ManagedSession>;

  beforeEach(() => {
    mockSessions = new Map();
    
    mockDeps = {
      getManagedSessions: mock(() => mockSessions),
      deleteManagedSession: mock(() => {}),
    };

    manager = new SessionManager(mockDeps);
  });

  describe("listSessions", () => {
    test("returns empty array when no sessions", async () => {
      const sessions = await manager.listSessions();
      expect(sessions).toEqual([]);
    });

    test("returns session list with correct fields", async () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
        name: "Test Session",
        agentId: "test-agent",
      });

      mockSessions.set("test-session", mockSession);

      const sessions = await manager.listSessions();

      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe("test-session");
      expect(sessions[0].name).toBe("Test Session");
      expect(sessions[0].agentId).toBe("test-agent");
      expect(sessions[0].messageCount).toBe(0);
      expect(sessions[0].isStreaming).toBe(false);
    });

    test("includes modified files when present", async () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
        modifiedFiles: new Set(["/path/to/file1.ts", "/path/to/file2.ts"]),
      });

      mockSessions.set("test-session", mockSession);

      const sessions = await manager.listSessions();

      expect(sessions[0].modifiedFiles).toBeDefined();
      expect(sessions[0].modifiedFiles!.length).toBe(2);
      expect(sessions[0].modifiedFiles).toContain("/path/to/file1.ts");
    });
  });

  describe("getSession", () => {
    test("returns null for non-existent session", async () => {
      const session = await manager.getSession("non-existent");
      expect(session).toBeNull();
    });

    test("returns session detail with messages", async () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
        name: "Test Session",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
      });

      mockSessions.set("test-session", mockSession);

      const session = await manager.getSession("test-session");

      expect(session).not.toBeNull();
      expect(session!.id).toBe("test-session");
      expect(session!.name).toBe("Test Session");
      expect(session!.messages.length).toBe(2);
    });

    test("includes working path when present", async () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
        workingPath: "/home/user/project",
      });

      mockSessions.set("test-session", mockSession);

      const session = await manager.getSession("test-session");

      expect(session!.workingPath).toBe("/home/user/project");
    });
  });

  describe("renameSession", () => {
    test("returns error for non-existent session", async () => {
      const result = await manager.renameSession("non-existent", "New Name");
      expect(result.success).toBe(false);
      expect(result.error).toBe("not_found");
    });

    test("renames session successfully", async () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
        name: "Old Name",
      });

      mockSessions.set("test-session", mockSession);

      const result = await manager.renameSession("test-session", "New Name");

      expect(result.success).toBe(true);
      expect(result.oldName).toBe("Old Name");
      expect(mockSession.name).toBe("New Name");
      expect(mockSession.autoRenamed).toBe(true);
    });

    test("does nothing if name is the same", async () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
        name: "Same Name",
      });

      mockSessions.set("test-session", mockSession);

      const result = await manager.renameSession("test-session", "Same Name");

      expect(result.success).toBe(true);
      expect(result.oldName).toBe("Same Name");
      expect(mockSession.autoRenamed).toBeUndefined();
    });

    test("updates updatedAt timestamp", async () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
        name: "Old Name",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      mockSessions.set("test-session", mockSession);

      await manager.renameSession("test-session", "New Name");

      expect(mockSession.updatedAt).not.toBe("2024-01-01T00:00:00.000Z");
    });
  });

  describe("deleteSession", () => {
    test("returns false for non-existent session", async () => {
      const result = await manager.deleteSession("non-existent");
      expect(result).toBe(false);
    });

    test("deletes session successfully", async () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
      });

      mockSessions.set("test-session", mockSession);

      const result = await manager.deleteSession("test-session");

      expect(result).toBe(true);
      // Check that deleteManagedSession was called
      expect(mockDeps.deleteManagedSession).toHaveBeenCalledWith("test-session");
    });

    test("calls dispose on session", async () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
      });

      mockSessions.set("test-session", mockSession);

      await manager.deleteSession("test-session");

      expect(mockSession.session.dispose).toHaveBeenCalled();
    });
  });

  describe("getStats", () => {
    test("returns null for non-existent session", () => {
      const stats = manager.getStats("non-existent");
      expect(stats).toBeNull();
    });

    test("returns session stats", () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
      });

      mockSessions.set("test-session", mockSession);

      const stats = manager.getStats("test-session");

      expect(stats).toBeDefined();
    });
  });

  describe("getCommands", () => {
    test("returns empty array for non-existent session", () => {
      const commands = manager.getCommands("non-existent");
      expect(commands).toEqual([]);
    });

    test("returns commands when available", () => {
      const mockSession = createMockManagedSession({
        id: "test-session",
        commands: [
          { name: "help", description: "Show help" },
          { name: "clear", description: "Clear screen" },
        ],
      });

      mockSessions.set("test-session", mockSession);

      const commands = manager.getCommands("test-session");

      expect(commands.length).toBe(2);
      expect(commands[0].name).toBe("help");
      expect(commands[0].source).toBe("extension");
    });
  });

  describe("createSession", () => {
    test("throws error (placeholder implementation)", async () => {
      await expect(manager.createSession()).rejects.toThrow("createSession should be implemented in AgentManager");
    });
  });

  describe("getOrCreateSessionForAgent", () => {
    test("throws error (placeholder implementation)", async () => {
      await expect(manager.getOrCreateSessionForAgent("test-agent")).rejects.toThrow("getOrCreateSessionForAgent should be implemented in AgentManager");
    });
  });
});

// ─── Helper Functions ────────────────────────────────────────

function createMockManagedSession(overrides?: Partial<ManagedSession>): ManagedSession {
  const messages = overrides?.messages || [];
  
  const mockSession = {
    messages,
    model: overrides?.model || null,
    isStreaming: false,
    sessionManager: {
      getSessionFile: mock(() => null),
    },
    dispose: mock(() => {}),
    getSessionStats: mock(() => ({
      messageCount: messages.length,
      tokenCount: 0,
    })),
    prompt: mock(() => Promise.resolve()),
    extensionRunner: overrides?.commands ? {
      getRegisteredCommands: mock(() => overrides.commands),
    } : null,
  };

  return {
    id: overrides?.id || "test-session",
    name: overrides?.name || "Test Session",
    agentId: overrides?.agentId || "test-agent",
    session: mockSession as any,
    resourceLoader: {} as any,
    createdAt: overrides?.createdAt || new Date().toISOString(),
    updatedAt: overrides?.updatedAt || new Date().toISOString(),
    workingPath: overrides?.workingPath,
    userMessageCount: overrides?.userMessageCount || 0,
    autoRenamed: overrides?.autoRenamed,
    modifiedFiles: overrides?.modifiedFiles,
    ...overrides,
  };
}
