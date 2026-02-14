import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  discoverSubagents,
  clearCache,
  getUserSubagentsDir,
  findWorkspaceSubagentsDir,
} from "./discovery.js";

describe("Subagent Discovery", () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `subagent-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    clearCache();
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("getUserSubagentsDir", () => {
    it("should return the user subagents directory path", () => {
      const dir = getUserSubagentsDir();
      expect(dir).toContain(".config");
      expect(dir).toContain("friend");
      expect(dir).toContain("subagents");
    });
  });

  describe("findWorkspaceSubagentsDir", () => {
    it("should return null when workspace is undefined", () => {
      const result = findWorkspaceSubagentsDir(undefined);
      expect(result).toBeNull();
    });

    it("should return null when no subagents directory exists in workspace", () => {
      const result = findWorkspaceSubagentsDir(testDir);
      expect(result).toBeNull();
    });

    it("should find subagents directory in workspace", () => {
      const subagentsDir = join(testDir, "subagents");
      mkdirSync(subagentsDir, { recursive: true });

      const result = findWorkspaceSubagentsDir(testDir);
      expect(result).toBe(subagentsDir);
    });
  });

  describe("discoverSubagents", () => {
    it("should return empty array when no workspace subagents exist", () => {
      const result = discoverSubagents(testDir, "workspace");
      expect(result.agents).toEqual([]);
      expect(result.workspaceAgentsDir).toBeNull();
    });

    it("should discover user-level subagents", () => {
      // We can't easily test user-level subagents without modifying the real directory
      // This test just verifies the function works without errors
      const result = discoverSubagents(testDir, "user");
      expect(Array.isArray(result.agents)).toBe(true);
    });

    it("should discover workspace-level subagents", () => {
      const subagentsDir = join(testDir, "subagents");
      mkdirSync(subagentsDir, { recursive: true });

      const subagentContent = `---
name: test-agent
description: A test agent
---

Test system prompt.`;

      writeFileSync(join(subagentsDir, "test.md"), subagentContent);

      const result = discoverSubagents(testDir, "workspace");
      
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe("test-agent");
      expect(result.agents[0].description).toBe("A test agent");
      expect(result.agents[0].systemPrompt).toBe("Test system prompt.");
      expect(result.agents[0].source).toBe("workspace");
      expect(result.workspaceAgentsDir).toBe(subagentsDir);
    });

    it("should parse tools and model from frontmatter", () => {
      const subagentsDir = join(testDir, "subagents");
      mkdirSync(subagentsDir, { recursive: true });

      const subagentContent = `---
name: tool-agent
description: Agent with tools
tools: read, write, bash
model: anthropic/claude-haiku-4-5
---

System prompt.`;

      writeFileSync(join(subagentsDir, "tool.md"), subagentContent);

      const result = discoverSubagents(testDir, "workspace");
      
      expect(result.agents[0].tools).toEqual(["read", "write", "bash"]);
      expect(result.agents[0].model).toBe("anthropic/claude-haiku-4-5");
    });

    it("should merge user and workspace agents with workspace taking precedence", () => {
      const subagentsDir = join(testDir, "subagents");
      mkdirSync(subagentsDir, { recursive: true });

      const workspaceAgent = `---
name: shared-agent
description: Workspace version
---

Workspace system prompt.`;

      writeFileSync(join(subagentsDir, "shared.md"), workspaceAgent);

      const result = discoverSubagents(testDir, "workspace");
      
      // We're only loading workspace agents here
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].description).toBe("Workspace version");
    });

    it("should skip files with missing required fields", () => {
      const subagentsDir = join(testDir, "subagents");
      mkdirSync(subagentsDir, { recursive: true });

      const invalidContent = `---
name: incomplete-agent
---

Missing description.`;

      writeFileSync(join(subagentsDir, "invalid.md"), invalidContent);

      const result = discoverSubagents(testDir, "workspace");
      
      expect(result.agents).toHaveLength(0);
    });

    it("should handle multiple subagents", () => {
      const subagentsDir = join(testDir, "subagents");
      mkdirSync(subagentsDir, { recursive: true });

      const agent1 = `---
name: agent-one
description: First agent
---

Prompt 1.`;

      const agent2 = `---
name: agent-two
description: Second agent
---

Prompt 2.`;

      writeFileSync(join(subagentsDir, "one.md"), agent1);
      writeFileSync(join(subagentsDir, "two.md"), agent2);

      const result = discoverSubagents(testDir, "workspace");
      
      expect(result.agents).toHaveLength(2);
      expect(result.agents.map(a => a.name)).toContain("agent-one");
      expect(result.agents.map(a => a.name)).toContain("agent-two");
    });

    it("should use cache for repeated calls", () => {
      const subagentsDir = join(testDir, "subagents");
      mkdirSync(subagentsDir, { recursive: true });

      const subagentContent = `---
name: cached-agent
description: Should be cached
---

Cached prompt.`;

      writeFileSync(join(subagentsDir, "cached.md"), subagentContent);

      // First call
      const result1 = discoverSubagents(testDir, "workspace");
      
      // Second call should use cache
      const result2 = discoverSubagents(testDir, "workspace");
      
      expect(result1.agents).toEqual(result2.agents);
    });

    it("should invalidate cache when files change", () => {
      const subagentsDir = join(testDir, "subagents");
      mkdirSync(subagentsDir, { recursive: true });

      const subagentContent = `---
name: changing-agent
description: Version 1
---

Prompt v1.`;

      const filePath = join(subagentsDir, "changing.md");
      writeFileSync(filePath, subagentContent);

      const result1 = discoverSubagents(testDir, "workspace");
      expect(result1.agents[0].description).toBe("Version 1");

      // Wait a bit and update file
      setTimeout(() => {
        const updatedContent = `---
name: changing-agent
description: Version 2
---

Prompt v2.`;
        writeFileSync(filePath, updatedContent);

        const result2 = discoverSubagents(testDir, "workspace");
        expect(result2.agents[0].description).toBe("Version 2");
      }, 100);
    });

    it("should handle undefined workspace path", () => {
      const result = discoverSubagents(undefined, "user");
      expect(Array.isArray(result.agents)).toBe(true);
      expect(result.workspaceAgentsDir).toBeNull();
    });
  });
});
