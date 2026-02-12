# Grep & Glob 工具

## Grep 工具

使用正则表达式通过 ripgrep 引擎搜索文件内容。提供快速、并行化的内容搜索，并具有结果限制和错误处理功能。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|-----|------|------|--------|------|
| `pattern` | string | ✅ 是 | - | 要搜索的正则表达式模式 |
| `path` | string | ❌ 否 | 当前目录 | 要搜索的目录 |
| `include` | string | ❌ 否 | - | 文件模式过滤器（例如 "*.js"、"*.{ts,tsx}"） |

### 行为

- 使用带有 `-nH` 标志的 ripgrep 输出文件名和行号
- 返回按文件修改时间排序的结果
- 限制为 100 个匹配项并带有截断通知
- 在 2000 个字符处截断单个行
- 处理 ripgrep 退出代码（0=匹配，1=无匹配，2=错误但可能有匹配）
- 过滤来自不可访问路径的结果

### 使用示例

```typescript
await grepTool.execute("grep-1", {
  pattern: "export",
  path: "./src",
  include: "*.ts",
});
```

---

## Glob 工具

使用基于修改时间的排序和截断查找匹配 glob 模式的文件。使用 ripgrep 的文件扫描引擎进行高效遍历。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|-----|------|------|--------|------|
| `pattern` | string | ✅ 是 | - | 匹配文件的 glob 模式 |
| `path` | string | ❌ 否 | 当前目录 | 要搜索的目录 |

### 行为

- 返回按修改时间排序的文件（最新的在前）
- 将结果限制为 100 个文件并带有截断通知
- 通过 ripgrep 的 `--hidden` 标志支持隐藏文件
- 将相对路径解析为绝对路径

### 使用示例

```typescript
await globTool.execute("glob-1", {
  pattern: "*.ts",
  path: "./src",
});
```

---

## 测试

```bash
bun test_grep.js
bun test_glob.js
```

---

## 集成

工具已在 `AgentManager` 中注册，可通过 AI 助手使用。
