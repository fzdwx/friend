import { describe, test, expect } from "bun:test";
import { extractTodoItems, isSafeCommand } from "./plan-mode.js";

describe("extractTodoItems", () => {
  test("4.1 - 标准格式的 plan", () => {
    const message = `Plan:
1. 创建配置文件
2. 安装依赖
3. 运行测试`;

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(3);
    expect(items[0].text).toBe("创建配置文件");
    expect(items[1].text).toBe("安装依赖");
    expect(items[2].text).toBe("运行测试");
  });

  test("4.1.2 - 标准格式带子任务", () => {
    const message = `Plan:
1. 创建配置文件
   1.1. 创建 package.json
   1.2. 创建 tsconfig.json
2. 安装依赖`;

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(2);
    expect(items[0].text).toBe("创建配置文件");
    expect(items[0].subtasks).toBeDefined();
    expect(items[0].subtasks!.length).toBe(2);
    expect(items[0].subtasks![0].text).toBe("创建 package.json");
    expect(items[0].subtasks![1].text).toBe("创建 tsconfig.json");
    expect(items[1].text).toBe("安装依赖");
  });

  test("4.2 - 带前置文本的 plan", () => {
    const message = `明白了！OpenClaw 的设计是 **"自动检测 + 用户确认安装"**，不是全自动安装。让我更新计划：

---

Plan:
1. 添加 skill 安装相关类型定义到 packages/shared/src/skills.ts
   1.1. 定义 SkillInstallSpec 类型（支持 brew/node/go/uv/download）
   1.2. 定义 SkillRequires 类型
2. 创建 frontmatter 解析模块 packages/server/src/agent/skills/frontmatter.ts
   2.1. 添加 yaml 和 json5 依赖到 packages/server/package.json`;

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(2);
    expect(items[0].text).toContain("添加 skill 安装相关类型定义");
    expect(items[0].subtasks).toBeDefined();
    expect(items[0].subtasks!.length).toBe(2);
    expect(items[0].subtasks![0].text).toContain("SkillInstallSpec");
    expect(items[1].text).toContain("创建 frontmatter 解析模块");
  });

  test("4.3 - 包含中文括号的 plan", () => {
    const message = `Plan:
1. 添加类型定义（支持 brew/node/go/uv/download）
   1.1. 定义 SkillInstallSpec 类型（包含多个安装方式）
2. 创建解析模块（packages/server/src/agent/skills/frontmatter.ts）`;

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(2);
    expect(items[0].text).toContain("添加类型定义");
    expect(items[0].subtasks).toBeDefined();
    expect(items[0].subtasks![0].text).toContain("SkillInstallSpec");
    expect(items[1].text).toContain("创建解析模块");
  });

  test("4.4.1 - 使用 ) 分隔符", () => {
    const message = `Plan:
1) 创建配置文件
2) 安装依赖
3) 运行测试`;

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(3);
    expect(items[0].text).toBe("创建配置文件");
    expect(items[1].text).toBe("安装依赖");
    expect(items[2].text).toBe("运行测试");
  });

  test("4.4.2 - 混合格式（. 和 )）", () => {
    const message = `Plan:
1. 创建配置文件
   1.1. 创建 package.json
   1.2) 创建 tsconfig.json
2) 安装依赖
   2.1. 安装 TypeScript
   2.2) 安装 ESLint`;

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(2);
    expect(items[0].subtasks!.length).toBe(2);
    expect(items[1].subtasks!.length).toBe(2);
  });

  test("4.4.3 - 带 markdown 加粗的 plan", () => {
    const message = `Plan:
1. **创建配置文件**
   1.1. 创建 \`package.json\`
2. 安装依赖`;

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(2);
    expect(items[0].text).toContain("创建配置文件");
  });

  test("4.4.4 - 空行和分隔符", () => {
    const message = `Plan:

1. 创建配置文件

   1.1. 创建 package.json

---
这行会被忽略

2. 安装依赖`;

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(2);
    expect(items[0].text).toBe("创建配置文件");
    expect(items[0].subtasks!.length).toBe(1);
    expect(items[1].text).toBe("安装依赖");
  });

  test("4.4.5 - 无效的 plan（无 Plan: 标题）", () => {
    const message = `1. 创建配置文件
2. 安装依赖`;

    const items = extractTodoItems(message);

    expect(items.length).toBe(0);
  });

  test("4.4.5.1 - '方案 N：' 不应被识别为 Plan 头部", () => {
    const message = `**我建议的方案：**

### 方案 1：修改时显示提示（推荐）

**优点：**
- 清晰的视觉提示

### 方案 2：修改时折叠

**优点：**
- 用户可以查看原计划

**我的建议是方案 1**，因为：
1. 用户可以在对话历史中查看原计划
2. 清晰的"正在修改"状态，不会混淆
3. 实现最简单

你更倾向于哪个方案？`;

    const items = extractTodoItems(message);

    expect(items.length).toBe(0);
  });

  test("4.4.6 - Windows 换行符 (\\r\\n)", () => {
    const message = "Plan:\r\n1. 创建配置文件\r\n2. 安装依赖";

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(2);
  });

  test("4.4.7 - 长任务文本（超过60字符）", () => {
    const message = `Plan:
1. 这是一个非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的任务描述需要被截断处理才能正常显示`;

    const items = extractTodoItems(message);
    
    expect(items.length).toBe(1);
    expect(items[0].text.length).toBeLessThanOrEqual(60);
    expect(items[0].text).toContain("...");
  });

  test("4.5 - 完整的复杂 plan（11个主任务带子任务、表格、markdown）", () => {
    const message = `明白了！OpenClaw 的设计是 **"自动检测 + 用户确认安装"**，不是全自动安装。让我更新计划：

---

Plan:
1. 添加 skill 安装相关类型定义到 packages/shared/src/skills.ts
   1.1. 定义 SkillInstallSpec 类型（支持 brew/node/go/uv/download）
   1.2. 定义 SkillRequires 类型
   1.3. 定义 SkillMetadata 类型
   1.4. 定义 SkillStatusEntry 类型
   1.5. 定义 SkillStatusReport 类型
   1.6. 定义 SkillInstallResult 类型

2. 创建 frontmatter 解析模块 packages/server/src/agent/skills/frontmatter.ts
   2.1. 添加 yaml 和 json5 依赖到 packages/server/package.json
   2.2. 实现 parseFrontmatterBlock 函数
   2.3. 实现 parseInstallSpec 函数
   2.4. 实现 resolveSkillMetadata 函数

3. 创建依赖检测模块 packages/server/src/agent/skills/status.ts
   3.1. 实现 hasBinary 函数
   3.2. 实现 checkSkillRequirements 函数
   3.3. 实现 buildSkillStatus 函数
   3.4. 实现 buildWorkspaceSkillStatus 函数

4. 创建安装执行模块 packages/server/src/agent/skills/install.ts
   4.1. 实现 buildInstallCommand 函数
   4.2. 实现 runCommandWithTimeout 函数
   4.3. 实现 installSkill 主函数

5. 扩展 API 路由 packages/server/src/routes/skills.ts
   5.1. 添加 GET /api/skills/status 端点
   5.2. 添加 POST /api/skills/install 端点
   5.3. 添加 POST /api/skills/update 端点

6. 【新增】实现首次启动时的 Skill 检测和提示
   6.1. 在服务启动后检测所有 skill 状态
   6.2. 发现缺失依赖时，在控制台输出提示信息
   6.3. 不自动安装，只提示用户前往设置页面
   6.4. 示例输出：\`⚠ 3 skills have missing dependencies. Run 'friend skills setup' or visit Settings > Skills.\`

7. 【新增】创建 Skill 状态检测命令 packages/server/src/commands/skills-doctor.ts
   7.1. 实现 \`friend skills status\` 命令（显示所有 skill 状态）
   7.2. 实现 \`friend skills setup\` 命令（交互式安装缺失依赖）
   7.3. 参考 openclaw 的 \`setupSkills()\` 流程
   7.4. 使用 Question tool 询问用户要安装哪些 skill

8. 【新增】前端设置页面集成
   8.1. 在设置页面添加 "Skills" 标签页
   8.2. 显示所有 skill 列表和状态
   8.3. 缺失依赖显示"安装"按钮
   8.4. 可用 skill 显示启用/禁用开关
   8.5. 需要配置的 skill 显示 API key 输入框

9. 创建前端 API 方法 packages/app/src/lib/api.ts
   9.1. 添加 getSkillsStatus 方法
   9.2. 添加 installSkill 方法
   9.3. 添加 updateSkill 方法

10. 更新内置 skill 示例添加 metadata
   10.1. 更新 skill-creator/SKILL.md.txt 添加示例 metadata

11. 添加配置存储支持
   11.1. 在 config 类型中添加 skills.entries 配置结构
   11.2. 支持每个 skill 的 enabled/apiKey/env 配置

---

**关键设计决策**：

| 时机 | 行为 | 说明 |
|------|------|------|
| 服务启动 | 检测 + 提示 | 自动检测缺失依赖，输出提示信息，不自动安装 |
| 命令行 \`friend skills setup\` | 交互式安装 | 使用 Question tool 询问用户要安装哪些 |
| 前端设置页面 | 手动安装 | 用户点击"安装"按钮触发 |
| API 调用 | 执行安装 | 前端/CLI 调用 skills.install API |

**为什么不自动安装？**
1. 安全考虑：执行系统命令（brew/npm/go）有风险
2. 用户选择：用户可能不想安装某些 skill
3. 需要输入：某些 skill 需要 API key 等配置`;

    const items = extractTodoItems(message);
    
    // 验证主任务数量
    expect(items.length).toBe(11);
    
    // 验证第一个主任务
    expect(items[0].text).toContain("添加 skill 安装相关类型定义");
    expect(items[0].subtasks).toBeDefined();
    expect(items[0].subtasks!.length).toBe(6);
    expect(items[0].subtasks![0].text).toContain("SkillInstallSpec");
    
    // 验证第二个主任务
    expect(items[1].text).toContain("创建 frontmatter 解析模块");
    expect(items[1].subtasks!.length).toBe(4);
    
    // 验证中间的任务（如第6个）
    expect(items[5].text).toContain("首次启动时的 Skill 检测");
    expect(items[5].subtasks!.length).toBe(4);
    
    // 验证最后一个主任务
    expect(items[10].text).toContain("配置存储支持");
    expect(items[10].subtasks!.length).toBe(2);
    
    // 验证所有主任务都有子任务
    const allHaveSubtasks = items.every(item => item.subtasks && item.subtasks.length > 0);
    expect(allHaveSubtasks).toBe(true);
  });

  test("markdown header: ## Plan", () => {
    const message = `Here is my analysis:

## Plan
1. Create config file at src/config.ts
2. Install dependencies
3. Run tests`;

    const items = extractTodoItems(message);

    expect(items.length).toBe(3);
    expect(items[0].text).toBe("Create config file at src/config.ts");
    expect(items[1].text).toBe("Install dependencies");
  });

  test("markdown header: ### Plan:", () => {
    const message = `### Plan:
1. Update the API endpoint
2. Add error handling`;

    const items = extractTodoItems(message);

    expect(items.length).toBe(2);
    expect(items[0].text).toBe("Update the API endpoint");
  });

  test("markdown header: ## Implementation Plan", () => {
    const message = `## Implementation Plan
1. Refactor auth module
2. Add unit tests`;

    const items = extractTodoItems(message);

    expect(items.length).toBe(2);
    expect(items[0].text).toBe("Refactor auth module");
  });

  test("steps starting with backtick are preserved", () => {
    const message = `Plan:
1. Update \`package.json\` with new dependencies
2. Modify \`/src/config.ts\` to add settings`;

    const items = extractTodoItems(message);

    expect(items.length).toBe(2);
    expect(items[0].text).toContain("package.json");
    expect(items[1].text).toContain("/src/config.ts");
  });

  test("steps starting with slash path are preserved", () => {
    const message = `Plan:
1. /src/utils/helpers.ts needs refactoring
2. Create new module`;

    const items = extractTodoItems(message);

    expect(items.length).toBe(2);
    expect(items[0].text).toContain("/src/utils/helpers.ts");
  });

  test("markdown headers within plan don't terminate parsing", () => {
    const message = `Plan:
1. First task

### Phase 1

2. Second task
3. Third task

### Phase 2

4. Fourth task`;

    const items = extractTodoItems(message);

    expect(items.length).toBe(4);
    expect(items[0].text).toBe("First task");
    expect(items[3].text).toBe("Fourth task");
  });

  test("verb prefixes are preserved in step text", () => {
    const message = `Plan:
1. Create API endpoint at src/api.ts
2. Install the required dependencies
3. Run the test suite
4. Update configuration file`;

    const items = extractTodoItems(message);

    expect(items.length).toBe(4);
    expect(items[0].text).toBe("Create API endpoint at src/api.ts");
    expect(items[1].text).toContain("Install");
    expect(items[2].text).toContain("Run");
    expect(items[3].text).toContain("Update");
  });
});

describe("isSafeCommand", () => {
  test("allows simple read-only commands", () => {
    expect(isSafeCommand("cat foo.txt")).toBe(true);
    expect(isSafeCommand("ls -la")).toBe(true);
    expect(isSafeCommand("grep -r 'pattern' .")).toBe(true);
    expect(isSafeCommand("git status")).toBe(true);
    expect(isSafeCommand("git log --oneline")).toBe(true);
  });

  test("blocks destructive commands", () => {
    expect(isSafeCommand("rm -rf /")).toBe(false);
    expect(isSafeCommand("git push origin main")).toBe(false);
    expect(isSafeCommand("npm install express")).toBe(false);
  });

  test("allows piped read-only commands", () => {
    expect(isSafeCommand("cat foo.txt | grep pattern")).toBe(true);
    expect(isSafeCommand("ls -la | sort")).toBe(true);
  });

  test("handles && correctly", () => {
    expect(isSafeCommand("cd /project && ls -la")).toBe(true);
    expect(isSafeCommand("cd /project && cat foo.txt")).toBe(true);
    expect(isSafeCommand("cd /project && rm -rf .")).toBe(false);
  });

  test("handles || correctly (not confused with pipe)", () => {
    expect(isSafeCommand("cat foo.txt || echo fallback")).toBe(true);
    expect(isSafeCommand("ls -la || echo 'not found'")).toBe(true);
  });

  test("blocks $() command substitution", () => {
    expect(isSafeCommand("echo $(rm -rf /)")).toBe(false);
    expect(isSafeCommand("cat $(whoami)")).toBe(false);
  });

  test("blocks backtick command substitution", () => {
    expect(isSafeCommand("echo `rm -rf /`")).toBe(false);
    expect(isSafeCommand("cat `whoami`")).toBe(false);
  });

  test("allows cd command", () => {
    expect(isSafeCommand("cd /home/user/project")).toBe(true);
  });

  test("allows version check commands", () => {
    expect(isSafeCommand("bun --version")).toBe(true);
    expect(isSafeCommand("deno --version")).toBe(true);
    expect(isSafeCommand("cargo --version")).toBe(true);
    expect(isSafeCommand("go version")).toBe(true);
    expect(isSafeCommand("rustc --version")).toBe(true);
  });

  test("allows pnpm read-only commands", () => {
    expect(isSafeCommand("pnpm list")).toBe(true);
    expect(isSafeCommand("pnpm why react")).toBe(true);
    expect(isSafeCommand("pnpm audit")).toBe(true);
  });

  test("allows /dev/null redirection", () => {
    expect(isSafeCommand("cat foo.txt 2>/dev/null")).toBe(true);
    expect(isSafeCommand("ls -la 2> /dev/null")).toBe(true);
  });
});
