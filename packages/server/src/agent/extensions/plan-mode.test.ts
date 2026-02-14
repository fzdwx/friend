import { describe, test, expect } from "bun:test";
import { extractTodoItems } from "./plan-mode.js";

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
});
